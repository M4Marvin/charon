import {
  getMessage as repoGetMessage,
  updateMessage as repoUpdateMessage,
} from "@/db/repositories/chats";
import type { DB } from "@/db";
import { db as defaultDb } from "@/db";
import { createLogger } from "@/features/logging";
import type { ChatLockState } from "./types";

const log = createLogger("chat:tree:lock");

export const STALE_LOCK_MS = 5 * 60 * 1000;

function readLock(chatId: string, db: DB): ChatLockState | null {
  const root = repoGetMessage(chatId, 0, db);
  if (!root?.extra) return null;
  if (root.extra.lock !== "generating") return null;
  return root.extra as unknown as ChatLockState;
}

export function ensureChatIdle(chatId: string, db: DB = defaultDb): void {
  const lock = readLock(chatId, db);
  if (!lock) return;

  const age = Date.now() - lock.lockedAt;
  if (age <= STALE_LOCK_MS) {
    throw new Error("Chat is busy: generation in progress");
  }

  log.warn("Stale lock cleared", { chatId, lockedAt: lock.lockedAt, ageMs: age });
  repoUpdateMessage(chatId, 0, { extra: null }, db);
}

export function acquireGenerationLock(
  chatId: string,
  messageLocalId: number,
  db: DB = defaultDb,
): void {
  const previousLock = readLock(chatId, db);
  const previousAge = previousLock ? Date.now() - previousLock.lockedAt : null;

  ensureChatIdle(chatId, db);

  if (previousLock && previousAge !== null && previousAge > STALE_LOCK_MS) {
    log.warn("Stale lock cleared before acquire", {
      chatId,
      previousMessageId: previousLock.messageId,
      previousLockedAt: previousLock.lockedAt,
      ageMs: previousAge,
    });
  }

  const lockState: ChatLockState = {
    lock: "generating",
    messageId: messageLocalId,
    lockedAt: Date.now(),
  };
  repoUpdateMessage(chatId, 0, { extra: lockState as unknown as Record<string, unknown> }, db);
  log.info("Lock acquired", { chatId, messageLocalId });
}

export function releaseLock(chatId: string, messageLocalId: number, db: DB = defaultDb): void {
  const previousLock = readLock(chatId, db);
  if (!previousLock) return;
  if (previousLock.messageId !== messageLocalId) {
    log.warn("release skipped: lock owned by another generation", {
      chatId,
      messageLocalId,
      ownerMessageId: previousLock.messageId,
    });
    return;
  }
  repoUpdateMessage(chatId, 0, { extra: null }, db);
  log.info("Lock released", { chatId, messageLocalId });
}
