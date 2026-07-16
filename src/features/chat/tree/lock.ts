import {
  getMessage as repoGetMessage,
  updateMessage as repoUpdateMessage,
} from "@/db/repositories/chats";
import type { DB } from "@/db";
import { db as defaultDb } from "@/db";
import type { ChatLockState } from "./types";

export const STALE_LOCK_MS = 5 * 60 * 1000;

function readLock(
  userId: string,
  chatId: string,
  db: DB,
): ChatLockState | null {
  const root = repoGetMessage(userId, chatId, 0, db);
  if (!root?.extra) return null;
  if (root.extra.lock !== "generating") return null;
  return root.extra as unknown as ChatLockState;
}

export function ensureChatIdle(
  userId: string,
  chatId: string,
  db: DB = defaultDb,
): void {
  const lock = readLock(userId, chatId, db);
  if (!lock) return;

  const age = Date.now() - lock.lockedAt;
  if (age <= STALE_LOCK_MS) {
    throw new Error("Chat is busy: generation in progress");
  }

  repoUpdateMessage(userId, chatId, 0, { extra: null }, db);
}

export function acquireGenerationLock(
  userId: string,
  chatId: string,
  messageLocalId: number,
  db: DB = defaultDb,
): void {
  ensureChatIdle(userId, chatId, db);

  const lockState: ChatLockState = {
    lock: "generating",
    messageId: messageLocalId,
    lockedAt: Date.now(),
  };
  repoUpdateMessage(
    userId,
    chatId,
    0,
    { extra: lockState as unknown as Record<string, unknown> },
    db,
  );
}

export function releaseLock(
  userId: string,
  chatId: string,
  db: DB = defaultDb,
): void {
  repoUpdateMessage(userId, chatId, 0, { extra: null }, db);
}
