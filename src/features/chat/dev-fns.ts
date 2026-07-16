import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/server/session";
import {
  listChats,
  getChat,
  getMessages,
  getActivePath,
  createChat,
  appendMessage,
  appendUserAndReply,
  swipe,
  editMessage,
  deleteBranch,
} from "./tree/service";
import { acquireGenerationLock, releaseLock } from "./tree/lock";
import { listCharacters } from "@/db/repositories/characters";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getNode } from "@/lib/st-core/chat-tree/tree";
import { appendChild } from "./tree/operations";
import {
  listMessages as repoListMessages,
  insertMessage as repoInsertMessage,
  updateMessage as repoUpdateMessage,
} from "@/db/repositories/chats";
import type { ChatWithCharacter } from "@/db/repositories/chats";
import type { ChatMessageRow } from "@/db/schema";
import type { ChatMessage } from "@/lib/st-core/shared/types";

export type ChatWithLock = ChatWithCharacter & {
  lockState: "idle" | "generating";
  lockMessageLocalId: number | null;
};

type CharacterSummary = {
  id: string;
  name: string;
  spec: string;
};

function rowToMsg(row: ChatMessageRow): ChatMessage {
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

// ── Chats ──

export const listDevChats = createServerFn({ method: "GET", strict: { output: false } }).handler(
  async () => {
    const { user } = await getSession();
    const raw = listChats(user.id);
    const out: ChatWithLock[] = [];
    for (const c of raw) {
      const detail = getChat(user.id, c.id);
      out.push({
        ...c,
        lockState: detail.lockState,
        lockMessageLocalId: detail.lockMessageLocalId,
      });
    }
    return out;
  },
);

// ── Characters ──

export const listDevCharacters = createServerFn({
  method: "GET",
  strict: { output: false },
}).handler(async () => {
  const { user } = await getSession();
  const chars = listCharacters(user.id);
  return chars.map(
    (c) => ({ id: c.id, name: c.name, spec: c.spec ?? "unknown" }) satisfies CharacterSummary,
  );
});

// ── Chat CRUD ──

export const createTestChat = createServerFn({ method: "POST", strict: { output: false } })
  .validator((d: unknown) => d as { characterId: string; title: string })
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return createChat(user.id, {
      characterId: data.characterId,
      title: data.title,
      greetings: ["Hello there! How are you today?", "Hey! Good to see you."],
    });
  });

export const getDevChatDetail = createServerFn({ method: "GET", strict: { output: false } })
  .validator((d: unknown) => d as { chatId: string })
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return getChat(user.id, data.chatId);
  });

export const getDevMessages = createServerFn({ method: "GET", strict: { output: false } })
  .validator((d: unknown) => d as { chatId: string })
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return getMessages(user.id, data.chatId);
  });

export const getDevActivePath = createServerFn({ method: "GET", strict: { output: false } })
  .validator((d: unknown) => d as { chatId: string })
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return getActivePath(user.id, data.chatId);
  });

// ── Tree operations ──

export const devAppendMessage = createServerFn({ method: "POST", strict: { output: false } })
  .validator(
    (d: unknown) =>
      d as { chatId: string; role: "user" | "assistant"; content: string; parentLocalId?: number },
  )
  .handler(async ({ data }) => {
    const { user } = await getSession();
    if (data.parentLocalId === undefined) {
      return appendMessage(user.id, data.chatId, { role: data.role, content: data.content });
    }
    // Append to specific parent — manual tree load + persist
    const rows = repoListMessages(user.id, data.chatId);
    const tree = treeFromNodes(rows.map(rowToMsg));
    const newNode = appendChild(tree, data.parentLocalId, {
      role: data.role,
      content: data.content,
    });
    const parent = getNode(tree, data.parentLocalId);
    repoUpdateMessage(user.id, data.chatId, data.parentLocalId, {
      children: parent.children,
      selectedChildLocalId: parent.selectedChildLocalId,
    });
    repoInsertMessage(user.id, data.chatId, {
      chatId: data.chatId,
      localId: newNode.localId,
      parentLocalId: newNode.parentLocalId,
      children: newNode.children,
      selectedChildLocalId: newNode.selectedChildLocalId,
      role: newNode.role,
      content: newNode.content,
      extra: newNode.extra ?? null,
    });
    return newNode;
  });

export const devAppendUserAndReply = createServerFn({ method: "POST", strict: { output: false } })
  .validator((d: unknown) => d as { chatId: string; userContent: string; replyContent: string })
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return appendUserAndReply(user.id, data.chatId, data.userContent, data.replyContent);
  });

export const devSwipe = createServerFn({ method: "POST", strict: { output: false } })
  .validator(
    (d: unknown) => d as { chatId: string; messageLocalId: number; direction: "next" | "prev" },
  )
  .handler(async ({ data }) => {
    const { user } = await getSession();
    const msgs = getMessages(user.id, data.chatId);
    const target = msgs.find((m) => m.localId === data.messageLocalId);
    const createIfMissing =
      target && data.direction === "next"
        ? { role: target.role as "user" | "assistant", content: "(new)" }
        : undefined;
    return swipe(user.id, data.chatId, data.messageLocalId, data.direction, createIfMissing);
  });

export const devEditMessage = createServerFn({ method: "POST", strict: { output: false } })
  .validator((d: unknown) => d as { chatId: string; messageLocalId: number; content: string })
  .handler(async ({ data }) => {
    const { user } = await getSession();
    editMessage(user.id, data.chatId, data.messageLocalId, data.content);
    return { ok: true };
  });

export const devDeleteBranch = createServerFn({ method: "POST", strict: { output: false } })
  .validator((d: unknown) => d as { chatId: string; messageLocalId: number })
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return deleteBranch(user.id, data.chatId, data.messageLocalId);
  });

// ── Lock operations ──

export const devAcquireLock = createServerFn({ method: "POST", strict: { output: false } })
  .validator((d: unknown) => d as { chatId: string; messageLocalId: number })
  .handler(async ({ data }) => {
    const { user } = await getSession();
    acquireGenerationLock(user.id, data.chatId, data.messageLocalId);
    return { ok: true };
  });

export const devReleaseLock = createServerFn({ method: "POST", strict: { output: false } })
  .validator((d: unknown) => d as { chatId: string })
  .handler(async ({ data }) => {
    const { user } = await getSession();
    releaseLock(user.id, data.chatId);
    return { ok: true };
  });
