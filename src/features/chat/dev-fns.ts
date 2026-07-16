import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/server/session";
import { listChats, getChat, getMessages, getActivePath, createChat, appendUserAndReply, swipe, editMessage, deleteBranch } from "./tree/service";
import { acquireGenerationLock, releaseLock } from "./tree/lock";
import { listCharacters } from "@/db/repositories/characters";
import type { ChatWithCharacter } from "@/db/repositories/chats";

export type ChatWithLock = ChatWithCharacter & {
  lockState: "idle" | "generating";
  lockMessageLocalId: number | null;
};

type CharacterSummary = {
  id: string;
  name: string;
  spec: string;
};

// ── Chats ──

export const listDevChats = createServerFn({ method: "GET", strict: { output: false } }).handler(async () => {
  const { user } = await getSession();
  const raw = listChats(user.id);
  const out: ChatWithLock[] = [];
  for (const c of raw) {
    const detail = getChat(user.id, c.id);
    out.push({ ...c, lockState: detail.lockState, lockMessageLocalId: detail.lockMessageLocalId });
  }
  return out;
});

// ── Characters ──

export const listDevCharacters = createServerFn({ method: "GET", strict: { output: false } }).handler(async () => {
  const { user } = await getSession();
  const chars = listCharacters(user.id);
  return chars.map((c) => ({ id: c.id, name: c.name, spec: c.spec ?? "unknown" } satisfies CharacterSummary));
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

export const devAppendUserAndReply = createServerFn({ method: "POST", strict: { output: false } })
  .validator((d: unknown) => d as { chatId: string; userContent: string; replyContent: string })
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return appendUserAndReply(user.id, data.chatId, data.userContent, data.replyContent);
  });

export const devSwipe = createServerFn({ method: "POST", strict: { output: false } })
  .validator((d: unknown) => d as { chatId: string; messageLocalId: number; direction: "next" | "prev" })
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return swipe(user.id, data.chatId, data.messageLocalId, data.direction);
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
