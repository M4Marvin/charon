import type { TokenUsage } from "@tanstack/ai";
import { db as defaultDb, type DB } from "@/db";
import { finalizeJob, getJob } from "@/db/repositories/generation";
import { updateMessage } from "@/db/repositories/chats";
import { EmptyResponseError, GenerationValidationError, LeaseLostError } from "./errors";

export interface FinalizeChatInput {
  jobId: string;
  owner: string;
  epoch: number;
  text: string;
  usage?: TokenUsage;
  finishReason?: string | null;
}

/**
 * Persist the completed assistant turn and the job in one transaction. If the
 * lease was lost between the last chunk and finalize, the message write rolls
 * back instead of leaving a reply the job does not own.
 */
export function finalizeChat(input: FinalizeChatInput, db: DB = defaultDb): void {
  db.transaction((tx) => {
    const txDb = tx as unknown as DB;
    const job = getJob(input.jobId, txDb);
    if (!job) throw new GenerationValidationError({ message: "Generation job not found" });
    if (!input.text.trim()) {
      throw new EmptyResponseError({
        message: "The model returned no text.",
        finishReason: input.finishReason ?? null,
      });
    }
    if (job.leaseOwner !== input.owner || job.leaseEpoch !== input.epoch) {
      throw new LeaseLostError({
        message: "The generation lease was lost before finalize.",
        jobId: input.jobId,
      });
    }
    if (job.placeholderLocalId && job.placeholderLocalId > 0) {
      updateMessage(
        job.chatId,
        job.placeholderLocalId,
        {
          content: input.text,
          extra: {
            generationJobId: input.jobId,
            finishReason: input.finishReason ?? null,
            usage: input.usage ?? null,
          },
        },
        txDb,
      );
    }
    const finalized = finalizeJob(
      {
        jobId: input.jobId,
        owner: input.owner,
        epoch: input.epoch,
        result: {
          kind: "message",
          localIds: job.placeholderLocalId ? [job.placeholderLocalId] : [],
        },
        usage: input.usage as unknown as Record<string, unknown> | undefined,
        finishReason: input.finishReason ?? null,
      },
      txDb,
    );
    if (!finalized) {
      throw new LeaseLostError({
        message: "The generation lease was lost before finalize.",
        jobId: input.jobId,
      });
    }
  });
}
