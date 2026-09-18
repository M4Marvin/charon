import { db as defaultDb, type DB } from "@/db";
import type { PrepareStreamInput, PrepareStreamResult } from "./types";
import { getChat as repoGetChat } from "@/db/repositories/chats";
import {
  getMessage as repoGetMessage,
  updateMessage as repoUpdateMessage,
} from "@/db/repositories/chats";
import { getCharacter as repoGetCharacter } from "@/db/repositories/characters";
import { getUserSettings } from "@/db/repositories/userSettings";
import {
  appendMessage,
  appendUserAndReply,
  appendSibling,
  deleteBranch,
  getMessages,
} from "../tree/service";
import { acquireGenerationLock, releaseLock, ensureChatIdle } from "../tree/lock";
import { substituteMessageMacros } from "@/lib/chat/substitute-message-macros";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getActiveLeafId, getNode } from "@/lib/st-core/chat-tree/tree";
import { resolvePersona } from "../config/persona";
import { hasProvider } from "../config/service";
import { pickDefaultReply } from "./default-replies";
import { createLogger } from "@/features/logging";

const log = createLogger("chat:gen:service");

function loadMacroEnv(
  userId: string, // account FK
  chatId: string,
  fallbackUserName: string,
  db: DB,
): { char: string; user: string } {
  const chat = repoGetChat(chatId, db);
  const char = repoGetCharacter(chat.characterId, db);
  return {
    char: char.data.name,
    user: resolvePersona(userId, fallbackUserName, db).name,
  };
}

export function prepareStream(
  userId: string, // account FK
  input: PrepareStreamInput,
  userName: string,
  db: DB = defaultDb,
): PrepareStreamResult {
  // Persisting the user/assistant rows and acquiring the lock must be
  // all-or-nothing: a partial write would strand a placeholder + lock that
  // the client can no longer identify (it only learns the id on success),
  // and the client relies on "throw == nothing persisted" to safely restore
  // the draft. better-sqlite3 transactions are synchronous, matching this fn.
  return db.transaction((tx) => prepareStreamTx(userId, input, userName, tx as unknown as DB));
}

function prepareStreamTx(
  userId: string, // account FK
  input: PrepareStreamInput,
  userName: string,
  db: DB,
): PrepareStreamResult {
  log.debug("prepareStream start", { chatId: input.chatId, mode: input.mode });

  ensureChatIdle(input.chatId, db);

  if (input.mode === "send") {
    const content = input.content?.trim() ?? "";
    if (!content) throw new Error("Content is required for send mode");

    const macroEnv = loadMacroEnv(userId, input.chatId, userName, db);
    const userContent = substituteMessageMacros(content, macroEnv);

    const settings = getUserSettings(userId, db); // account FK
    if (!hasProvider(settings)) {
      const reply = substituteMessageMacros(pickDefaultReply(), macroEnv);
      const { replyMessage } = appendUserAndReply(input.chatId, userContent, reply, undefined, db);
      log.info("prepareStream: fallback mode (no provider)", {
        assistantMessageLocalId: replyMessage.localId,
      });
      return { mode: "fallback", assistantMessageLocalId: replyMessage.localId };
    }

    const { replyMessage } = appendUserAndReply(
      input.chatId,
      userContent,
      "",
      { isStreaming: true },
      db,
    );
    acquireGenerationLock(input.chatId, replyMessage.localId, db);
    log.info("prepareStream: stream mode", { assistantMessageLocalId: replyMessage.localId });
    return { mode: "stream", assistantMessageLocalId: replyMessage.localId };
  }

  if (input.mode === "regenerate") {
    const targetId = input.messageLocalId ?? 0;
    if (targetId === 0) throw new Error("Cannot regenerate the root message");

    const tree = treeFromNodes(getMessages(input.chatId, db));
    const target = getNode(tree, targetId);
    if (!target) throw new Error("Message not found");
    if (target.role !== "assistant") throw new Error("Can only regenerate assistant messages");
    if (target.parentLocalId === null) throw new Error("Cannot regenerate the root message");
    if ((target.extra?.isStreaming ?? false) === true) {
      throw new Error("Cannot regenerate a message that is still streaming");
    }

    const sibling = appendSibling(
      input.chatId,
      targetId,
      { role: "assistant", content: "", extra: { isStreaming: true } },
      db,
    );
    acquireGenerationLock(input.chatId, sibling.localId, db);
    return { mode: "stream", assistantMessageLocalId: sibling.localId };
  }

  // mode === "continue"
  const tree = treeFromNodes(getMessages(input.chatId, db));
  const activeLeafId = getActiveLeafId(tree);
  if (activeLeafId === null) throw new Error("No active message to continue from");
  const leaf = getNode(tree, activeLeafId);
  if (leaf.localId === 0 || leaf.parentLocalId === null) {
    throw new Error("Cannot continue from the root message");
  }

  if (leaf.role === "user") {
    const node = appendMessage(
      input.chatId,
      { role: "assistant", content: "", extra: { isStreaming: true } },
      db,
    );
    acquireGenerationLock(input.chatId, node.localId, db);
    return { mode: "stream", assistantMessageLocalId: node.localId };
  }

  if ((leaf.extra?.isStreaming ?? false) === true) {
    throw new Error("Cannot continue from a message that is still streaming");
  }
  const sibling = appendSibling(
    input.chatId,
    activeLeafId,
    { role: "assistant", content: "", extra: { isStreaming: true } },
    db,
  );
  acquireGenerationLock(input.chatId, sibling.localId, db);
  return { mode: "stream", assistantMessageLocalId: sibling.localId };
}

export function finalizeStream(
  userId: string, // account FK
  chatId: string,
  messageLocalId: number,
  content: string,
  userName: string,
  db: DB = defaultDb,
): { messageLocalId: number; content: string } {
  log.debug("finalizeStream start", { chatId, messageLocalId });
  if (messageLocalId === 0) throw new Error("Cannot finalize the root message");

  const existing = repoGetMessage(chatId, messageLocalId, db);
  if (!existing) throw new Error("Message not found");
  if ((existing.extra?.isStreaming ?? false) !== true) {
    throw new Error("Message is not a streaming placeholder");
  }

  const macroEnv = loadMacroEnv(userId, chatId, userName, db);
  const finalContent = substituteMessageMacros(content, macroEnv);

  repoUpdateMessage(chatId, messageLocalId, { content: finalContent, extra: null }, db);
  releaseLock(chatId, db);
  log.info("finalizeStream done", { messageLocalId, contentLen: finalContent.length });
  return { messageLocalId, content: finalContent };
}

export function cancelStream(
  chatId: string,
  messageLocalId: number,
  db: DB = defaultDb,
): { deletedIds: number[] } {
  log.debug("cancelStream start", { chatId, messageLocalId });
  if (messageLocalId === 0) throw new Error("Cannot cancel the root message");

  let deletedIds: number[] = [];
  try {
    const result = deleteBranch(chatId, messageLocalId, db, { skipIdleCheck: true });
    deletedIds = result.deletedIds;
  } catch (err) {
    log.warn("cancelStream: deleteBranch failed, releasing lock anyway", {
      chatId,
      messageLocalId,
      error: (err as Error).message,
    });
  }
  releaseLock(chatId, db);
  log.info("cancelStream done", { messageLocalId, deletedCount: deletedIds.length });
  return { deletedIds };
}
