import { db as defaultDb, type DB } from "@/db";
import { cancelJob, failJob, getJob, type FailJobInput } from "@/db/repositories/generation";
import { getMessage } from "@/db/repositories/chats";
import { deleteBranch } from "@/features/chat/tree/service";

const TERMINAL_WITHOUT_REPLY = new Set(["cancelled", "failed", "expired"]);

/**
 * Remove the assistant placeholder owned by a job that cannot produce a reply.
 * Checks job identity and emptiness first: localIds are reused after deletion,
 * so a stale id must never delete or overwrite an unrelated message.
 */
export function discardUnfinishedPlaceholder(jobId: string, db: DB = defaultDb): boolean {
  try {
    const job = getJob(jobId, db);
    if (!job || !TERMINAL_WITHOUT_REPLY.has(job.status)) return false;
    const localId = job.placeholderLocalId;
    if (!localId || localId <= 0) return false;

    const placeholder = getMessage(job.chatId, localId, db);
    if (!placeholder || placeholder.role !== "assistant") return false;
    const extra = (placeholder.extra ?? {}) as Record<string, unknown>;
    if (extra.generationJobId !== jobId) return false;
    if (placeholder.content.trim().length > 0 || placeholder.children.length > 0) return false;

    deleteBranch(job.chatId, localId, db);
    return true;
  } catch {
    // Best effort: cleanup must never mask the generation error it follows.
    return false;
  }
}

/**
 * Fail a job and drop the placeholder it can no longer fill. A false return
 * means another writer already made the job terminal; its placeholder is left
 * alone because it may hold that writer's reply.
 */
export function failJobAndDiscardPlaceholder(input: FailJobInput, db: DB = defaultDb): boolean {
  const failed = failJob(input, db);
  if (failed) discardUnfinishedPlaceholder(input.jobId, db);
  return failed;
}

/**
 * Cancel a prepared/running job and drop its placeholder. Terminal failures
 * are cleaned up too, so a cancel after the stream died does not leave an
 * empty assistant row behind.
 */
export function cancelGeneration(jobId: string, db: DB = defaultDb): boolean {
  const cancelled = cancelJob(jobId, db);
  const job = cancelled ? undefined : getJob(jobId, db);
  if (cancelled || (job && TERMINAL_WITHOUT_REPLY.has(job.status))) {
    discardUnfinishedPlaceholder(jobId, db);
  }
  return cancelled;
}
