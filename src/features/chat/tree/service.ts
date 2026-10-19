import { randomUUID } from "node:crypto";
import type { ChatTree, ChatMessage } from "@/lib/st-core/shared/types";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getActiveLeafId, getNode } from "@/lib/st-core/chat-tree/tree";
import type { ChatMessageRow, NewChatMessageRow } from "@/db/schema";
import {
  getChat as repoGetChat,
  createChat as repoCreateChat,
  listChats as repoListChats,
  listMessages as repoListMessages,
  insertMessage as repoInsertMessage,
  updateMessage as repoUpdateMessage,
  deleteMessages as repoDeleteMessages,
  deleteChat as repoDeleteChat,
} from "@/db/repositories/chats";
import type { ChatWithCharacter } from "@/db/repositories/chats";
import type { DB } from "@/db";
import { db as defaultDb } from "@/db";
import { createLogger } from "@/features/logging";
import { contentHash } from "@/lib/chat/content-hash";
import { computeActivePathFromMessages, getPathToNode } from "./active-path";
import { appendChild, selectSibling, createSiblingAndSelect, removeBranch } from "./operations";
import type {
  ChatDetail,
  CreateChatInput,
  NewMessage,
  SiblingContent,
  SwipeResult,
  ActivePathEntry,
} from "./types";

const log = createLogger("chat:tree:service");

function rowToMessage(row: ChatMessageRow): ChatMessage {
  return {
    localId: row.localId,
    parentLocalId: row.parentLocalId,
    children: row.children ?? [],
    selectedChildLocalId: row.selectedChildLocalId,
    role: row.role,
    content: row.content,
    extra: row.extra ?? undefined,
  };
}

function messageToRow(chatId: string, msg: ChatMessage): NewChatMessageRow {
  return {
    chatId,
    localId: msg.localId,
    parentLocalId: msg.parentLocalId,
    children: msg.children,
    selectedChildLocalId: msg.selectedChildLocalId,
    role: msg.role,
    content: msg.content,
    extra: msg.extra ?? null,
  };
}

function loadTree(chatId: string, db: DB): ChatTree {
  const rows = repoListMessages(chatId, db);
  return treeFromNodes(rows.map(rowToMessage));
}

function persistParent(chatId: string, tree: ChatTree, parentId: number, db: DB): void {
  const parent = getNode(tree, parentId);
  repoUpdateMessage(
    chatId,
    parentId,
    {
      children: parent.children,
      selectedChildLocalId: parent.selectedChildLocalId,
    },
    db,
  );
}

function persistNewMessage(chatId: string, message: ChatMessage, db: DB): void {
  repoInsertMessage(chatId, messageToRow(chatId, message), db);
}

// ── Reads ──

export function listChats(db: DB = defaultDb): ChatWithCharacter[] {
  return repoListChats(db);
}

export function getChat(chatId: string, db: DB = defaultDb): ChatDetail {
  const chat = repoGetChat(chatId, db);

  return {
    id: chat.id,
    characterId: chat.characterId,
    title: chat.title,
    characterDescription: chat.characterDescription,
    characterPersonality: chat.characterPersonality,
    characterScenario: chat.characterScenario,
    characterSystemPrompt: chat.characterSystemPrompt,
    backgroundId: chat.backgroundId ?? null,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  };
}

export function getMessages(chatId: string, db: DB = defaultDb): ChatMessage[] {
  return repoListMessages(chatId, db).map(rowToMessage);
}

export function getActivePath(chatId: string, db: DB = defaultDb): ActivePathEntry[] {
  const messages = getMessages(chatId, db);
  return computeActivePathFromMessages(messages);
}

export function getPathToMessage(
  chatId: string,
  messageLocalId: number,
  db: DB = defaultDb,
): ChatMessage[] {
  const tree = loadTree(chatId, db);
  return getPathToNode(tree, messageLocalId);
}

// ── Chat lifecycle ──

export function createChat(input: CreateChatInput, db: DB = defaultDb): ChatDetail {
  if (input.greetings.length === 0) {
    throw new Error("createChat: at least one greeting is required");
  }

  const chatId = randomUUID();

  try {
    const chat = repoCreateChat(
      {
        id: chatId,
        characterId: input.characterId,
        title: input.title,
        characterDescription: input.characterDescription ?? "",
        characterPersonality: input.characterPersonality ?? "",
        characterScenario: input.characterScenario ?? "",
        characterSystemPrompt: input.characterSystemPrompt ?? "",
      },
      db,
    );

    repoInsertMessage(
      chatId,
      {
        chatId,
        localId: 0,
        parentLocalId: null,
        children: input.greetings.map((_, i) => i + 1),
        selectedChildLocalId: 1,
        role: "system",
        content: "",
        extra: null,
      },
      db,
    );

    input.greetings.forEach((text, i) => {
      repoInsertMessage(
        chatId,
        {
          chatId,
          localId: i + 1,
          parentLocalId: 0,
          children: [],
          selectedChildLocalId: null,
          role: "assistant",
          content: text,
          extra: null,
        },
        db,
      );
    });

    log.info("Chat created", {
      chatId,
      characterId: input.characterId,
      greetingCount: input.greetings.length,
    });

    return {
      id: chat.id,
      characterId: chat.characterId,
      title: chat.title,
      characterDescription: chat.characterDescription,
      characterPersonality: chat.characterPersonality,
      characterScenario: chat.characterScenario,
      characterSystemPrompt: chat.characterSystemPrompt,
      backgroundId: chat.backgroundId ?? null,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  } catch (e) {
    log.error("createChat failed", { chatId, characterId: input.characterId }, e as Error);
    throw e;
  }
}

export function deleteChat(chatId: string, db: DB = defaultDb): void {
  try {
    repoDeleteChat(chatId, db);
    log.info("Chat deleted", { chatId });
  } catch (e) {
    log.error("deleteChat failed", { chatId }, e as Error);
    throw e;
  }
}

// ── Message operations ──

export function appendMessage(chatId: string, msg: NewMessage, db: DB = defaultDb): ChatMessage {
  log.debug("appendMessage start", { chatId, role: msg.role });
  try {
    const rows = repoListMessages(chatId, db);
    const tree = treeFromNodes(rows.map(rowToMessage));
    const activeLeafId = getActiveLeafId(tree);
    if (activeLeafId === null) {
      throw new Error("No active message to append to");
    }

    const newNode = appendChild(tree, activeLeafId, msg);
    persistParent(chatId, tree, activeLeafId, db);
    persistNewMessage(chatId, newNode, db);
    log.info("Message appended", { chatId, messageLocalId: newNode.localId, role: msg.role });
    return newNode;
  } catch (e) {
    log.error("appendMessage failed", { chatId, role: msg.role }, e as Error);
    throw e;
  }
}

export function appendUserAndReply(
  chatId: string,
  userContent: string,
  replyContent: string,
  replyExtra?: Record<string, unknown>,
  db: DB = defaultDb,
): { userMessage: ChatMessage; replyMessage: ChatMessage } {
  if (userContent.length === 0) {
    throw new Error("User content cannot be empty");
  }
  log.debug("appendUserAndReply start", { chatId, userContentLength: userContent.length });

  try {
    const rows = repoListMessages(chatId, db);
    const tree = treeFromNodes(rows.map(rowToMessage));
    const activeLeafId = getActiveLeafId(tree);
    if (activeLeafId === null) {
      throw new Error("No active message to append to");
    }

    const userMessage = appendChild(tree, activeLeafId, {
      role: "user",
      content: userContent,
    });
    persistParent(chatId, tree, activeLeafId, db);
    persistNewMessage(chatId, userMessage, db);

    const replyMessage = appendChild(tree, userMessage.localId, {
      role: "assistant",
      content: replyContent,
      ...(replyExtra ? { extra: replyExtra } : {}),
    });
    persistParent(chatId, tree, userMessage.localId, db);
    persistNewMessage(chatId, replyMessage, db);

    log.info("User + reply appended", {
      chatId,
      userLocalId: userMessage.localId,
      replyLocalId: replyMessage.localId,
    });

    return { userMessage, replyMessage };
  } catch (e) {
    log.error("appendUserAndReply failed", { chatId }, e as Error);
    throw e;
  }
}

export function swipe(
  chatId: string,
  messageLocalId: number,
  direction: "next" | "prev",
  createIfMissing?: SiblingContent,
  db: DB = defaultDb,
): SwipeResult {
  log.debug("swipe start", { chatId, messageLocalId, direction });
  try {
    const rows = repoListMessages(chatId, db);
    const tree = treeFromNodes(rows.map(rowToMessage));

    const existing = selectSibling(tree, messageLocalId, direction);
    if (existing !== null || direction === "prev") {
      if (existing !== null) {
        persistParent(chatId, tree, existing.parentLocalId!, db);
      }
      log.info("Swipe result", {
        chatId,
        messageLocalId,
        direction,
        selectedLocalId: existing?.localId ?? messageLocalId,
        created: false,
      });
      return {
        selectedMessage: existing ?? getNode(tree, messageLocalId),
        created: false,
      };
    }

    if (!createIfMissing) {
      log.info("Swipe result", {
        chatId,
        messageLocalId,
        direction,
        selectedLocalId: messageLocalId,
        created: false,
      });
      return {
        selectedMessage: getNode(tree, messageLocalId),
        created: false,
      };
    }

    const target = getNode(tree, messageLocalId);
    const parentId = target.parentLocalId!;
    const newSibling = createSiblingAndSelect(tree, messageLocalId, createIfMissing);
    persistParent(chatId, tree, parentId, db);
    persistNewMessage(chatId, newSibling, db);
    log.info("Swipe result", {
      chatId,
      messageLocalId,
      direction,
      selectedLocalId: newSibling.localId,
      created: true,
    });
    return { selectedMessage: newSibling, created: true };
  } catch (e) {
    log.error("swipe failed", { chatId, messageLocalId, direction }, e as Error);
    throw e;
  }
}

export function appendSibling(
  chatId: string,
  targetLocalId: number,
  msg: SiblingContent,
  db: DB = defaultDb,
): ChatMessage {
  log.debug("appendSibling start", { chatId, targetLocalId });
  try {
    const rows = repoListMessages(chatId, db);
    const tree = treeFromNodes(rows.map(rowToMessage));
    const target = getNode(tree, targetLocalId);
    if (!target) throw new Error("Message not found");
    if (target.parentLocalId === null) {
      throw new Error("Cannot append a sibling to the root message");
    }
    const parentId = target.parentLocalId;
    const newSibling = appendChild(tree, parentId, msg);
    persistParent(chatId, tree, parentId, db);
    persistNewMessage(chatId, newSibling, db);
    log.info("Sibling appended", {
      chatId,
      targetLocalId,
      newLocalId: newSibling.localId,
    });
    return newSibling;
  } catch (e) {
    log.error("appendSibling failed", { chatId, targetLocalId }, e as Error);
    throw e;
  }
}

export function deleteBranch(
  chatId: string,
  messageLocalId: number,
  db: DB = defaultDb,
): { deletedIds: number[] } {
  if (messageLocalId === 0) {
    throw new Error("Cannot delete the hidden root (localId 0)");
  }
  log.debug("deleteBranch start", { chatId, messageLocalId });
  try {
    const rows = repoListMessages(chatId, db);
    const tree = treeFromNodes(rows.map(rowToMessage));
    const target = getNode(tree, messageLocalId);
    if (target.parentLocalId === null) {
      throw new Error("Cannot delete the root message");
    }
    const parentId = target.parentLocalId;
    const deletedIds = removeBranch(tree, messageLocalId);
    persistParent(chatId, tree, parentId, db);
    repoDeleteMessages(chatId, deletedIds, db);
    log.info("Branch deleted", { chatId, messageLocalId, deletedCount: deletedIds.length });
    return { deletedIds };
  } catch (e) {
    log.error("deleteBranch failed", { chatId, messageLocalId }, e as Error);
    throw e;
  }
}

export function editMessage(
  chatId: string,
  messageLocalId: number,
  content: string,
  db: DB = defaultDb,
): void {
  if (messageLocalId === 0) {
    throw new Error("Cannot edit the hidden root");
  }
  log.debug("editMessage start", { chatId, messageLocalId, contentLength: content.length });
  try {
    const msg = repoListMessages(chatId, db).find((r) => r.localId === messageLocalId);
    if (!msg) throw new Error("Message not found");
    const extra = (msg.extra ?? {}) as Record<string, unknown>;
    repoUpdateMessage(
      chatId,
      messageLocalId,
      {
        content,
        extra: { ...extra, rev: Number(extra.rev ?? 0) + 1, contentHash: contentHash(content) },
      },
      db,
    );
    log.info("Message edited", { chatId, messageLocalId, contentLength: content.length });
  } catch (e) {
    log.error("editMessage failed", { chatId, messageLocalId }, e as Error);
    throw e;
  }
}
