import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { db as defaultDb, type DB } from "@/db";
import {
  beginJob,
  failJob,
  finalizeJob,
  getJob,
  cancelJob,
  createProposal,
} from "@/db/repositories/generation";
import { updateMessage } from "@/db/repositories/chats";
import type { TokenUsage } from "@tanstack/ai";
import type { PreparedGeneration } from "./prepare";
import { prepareGeneration, type PrepareGenerationInput } from "./prepare";
import {
  AbortedError,
  ChatBusyError,
  ConfigError,
  EmptyResponseError,
  GenerationValidationError,
  LeaseLostError,
  type GenerationError,
} from "./errors";

export interface GenerationServiceShape {
  readonly prepare: (
    userId: string,
    input: PrepareGenerationInput,
    userName: string,
  ) => Effect.Effect<PreparedGeneration, GenerationError>;
  readonly begin: (
    jobId: string,
    owner: string,
  ) => Effect.Effect<{ owner: string; epoch: number; jobId: string; chatId: string }, GenerationError>;
  readonly finalizeChat: (input: {
    jobId: string;
    owner: string;
    epoch: number;
    text: string;
    usage?: TokenUsage;
    finishReason?: string | null;
  }) => Effect.Effect<void, GenerationError>;
  readonly fail: (input: {
    jobId: string;
    owner?: string;
    code: string;
    message: string;
    usage?: TokenUsage;
    finishReason?: string | null;
  }) => Effect.Effect<void, GenerationError>;
  readonly propose: (input: {
    jobId: string;
    chatId: string;
    kind: "rewrite" | "transform" | "impersonate" | "image";
    content: string;
    targetLocalId?: number | null;
    baseRev?: number | null;
    baseHash?: string | null;
    role?: "user" | "assistant" | null;
    meta?: Record<string, unknown>;
  }) => Effect.Effect<string, GenerationError>;
  readonly cancel: (jobId: string) => Effect.Effect<void, GenerationError>;
}

function asGenerationError(error: unknown): GenerationError {
  if (error && typeof error === "object" && "_tag" in error) {
    return error as GenerationError;
  }
  return new GenerationValidationError({
    message: error instanceof Error ? error.message : String(error),
  });
}

export class GenerationService extends Context.Service<
  GenerationService,
  GenerationServiceShape
>()("charon/GenerationService") {
  static readonly layer = Layer.succeed(GenerationService, {
    prepare: (userId, input, userName) =>
      Effect.tryPromise({
        try: () => prepareGeneration(userId, input, userName),
        catch: asGenerationError,
      }),

    begin: (jobId, owner) =>
      Effect.try({
        try: () => {
          const job = getJob(jobId);
          if (!job) throw new GenerationValidationError({ message: "Generation job not found" });
          const begun = beginJob({ jobId, owner });
          return {
            owner,
            epoch: begun.leaseEpoch,
            jobId: begun.id,
            chatId: begun.chatId,
          };
        },
        catch: asGenerationError,
      }),

    finalizeChat: (input) =>
      Effect.try({
        try: () => {
          const job = getJob(input.jobId);
          if (!job) throw new GenerationValidationError({ message: "Generation job not found" });
          if (!input.text.trim()) {
            throw new EmptyResponseError({
              message: "The model returned no text.",
              finishReason: input.finishReason ?? null,
            });
          }
          const ok = finalizeJob({
            jobId: input.jobId,
            owner: input.owner,
            epoch: input.epoch,
            result: { kind: "message", localIds: job.placeholderLocalId ? [job.placeholderLocalId] : [] },
            usage: input.usage as unknown as Record<string, unknown> | undefined,
            finishReason: input.finishReason ?? null,
          });
          if (!ok) {
            throw new LeaseLostError({
              message: "The generation lease was lost before finalize.",
              jobId: input.jobId,
            });
          }
          if (job.placeholderLocalId && job.placeholderLocalId > 0) {
            updateMessage(job.chatId, job.placeholderLocalId, {
              content: input.text,
              extra: {
                generationJobId: input.jobId,
                finishReason: input.finishReason ?? null,
                usage: input.usage ?? null,
              },
            });
          }
        },
        catch: asGenerationError,
      }),

    fail: (input) =>
      Effect.sync(() => {
        failJob({
          jobId: input.jobId,
          owner: input.owner,
          code: input.code,
          message: input.message,
          usage: input.usage as unknown as Record<string, unknown> | undefined,
          finishReason: input.finishReason ?? null,
        });
      }),

    propose: (input) =>
      Effect.sync(() => {
        const row = createProposal({
          jobId: input.jobId,
          chatId: input.chatId,
          kind: input.kind,
          proposedContent: input.content,
          targetLocalId: input.targetLocalId,
          baseRev: input.baseRev,
          baseHash: input.baseHash,
          proposedRole: input.role,
          meta: input.meta,
        });
        return row.id;
      }),

    cancel: (jobId) =>
      Effect.sync(() => {
        cancelJob(jobId);
      }),
  });
}

export const withGenerationService = <A, E>(
  f: (service: GenerationServiceShape) => Effect.Effect<A, E>,
): Effect.Effect<A, E, GenerationService> => Effect.flatMap(GenerationService, f);

export const generationRuntime = ManagedRuntime.make(GenerationService.layer);

export const runGeneration = <A, E>(
  effect: Effect.Effect<A, E, GenerationService>,
) => generationRuntime.runPromise(effect);

export function abortError(reason?: string): AbortedError {
  return new AbortedError({ message: "Generation aborted", reason });
}

export function busyError(chatId: string, activeJobId: string): ChatBusyError {
  return new ChatBusyError({
    message: "A generation is already running in this chat.",
    chatId,
    activeJobId,
  });
}

export function configError(message: string): ConfigError {
  return new ConfigError({ message });
}

export { defaultDb as generationDb, type DB as GenerationDb };
