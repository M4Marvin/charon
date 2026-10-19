import {
  chat as aiChat,
  type StreamChunk,
  type TokenUsage,
} from "@tanstack/ai";
import { withPersistence } from "@tanstack/ai-persistence";
import { db as defaultDb, type DB } from "@/db";
import { getJob, resolveProposal } from "@/db/repositories/generation";
import { getMessages } from "@/features/chat/tree/service";
import { aiPersistence } from "./persistence-singleton";
import { loadGenerationSnapshot } from "./context";
import { compilePrompt } from "./prompt";
import { makeAdapter } from "./provider";
import { readTools } from "./tools";
import { prepareGeneration } from "./prepare";
import { runGeneration, withGenerationService } from "./service";
import { EmptyResponseError, type GenerationError } from "./errors";
import { assembleImagePrompt, sanitizeImpersonation } from "./image";
import type { ToolContext, Trigger } from "./contract";

export interface RunProposalInput {
  chatId: string;
  trigger: Extract<Trigger, "impersonate" | "image" | "rewrite" | "transform">;
  content?: string;
  messageLocalId?: number;
  selection?: number[];
  instruction?: string;
}

export interface RunProposalResult {
  jobId: string;
  proposalId: string;
  text: string;
}

function finishReasonOf(chunk: StreamChunk): string | null {
  const value = chunk as unknown as {
    finishReason?: string | null;
    metadata?: { tanstack?: { finishReason?: string | null } };
  };
  return value.finishReason ?? value.metadata?.tanstack?.finishReason ?? null;
}

export async function runProposal(
  userId: string,
  userName: string,
  input: RunProposalInput,
  db: DB = defaultDb,
): Promise<RunProposalResult> {
  const prepared = await prepareGeneration(userId, input, userName, db);
  const job = getJob(prepared.jobId, db);
  if (!job) throw new Error("Generation job not found");

  const selection = Array.isArray(job.input?.selection)
    ? (job.input?.selection as number[])
    : input.selection ?? (input.messageLocalId ? [input.messageLocalId] : []);
  const snapshot = await loadGenerationSnapshot(userId, input.chatId, 0, selection, db);
  const compiled = compilePrompt(snapshot, job.promptMode);
  const adapter = makeAdapter(snapshot.provider);
  const owner = crypto.randomUUID();
  const lease = await runGeneration(
    withGenerationService((service) => service.begin(job.id, owner)),
  );
  const toolContext: ToolContext = {
    userId,
    chatId: input.chatId,
    jobId: job.id,
    mode: job.promptMode,
    baseLeafId: job.baseLeafId ?? 0,
    selection,
  };

  let text = "";
  let usage: TokenUsage | undefined;
  let finishReason: string | null = null;
  try {
    const stream = aiChat({
      adapter,
      messages: compiled.messages,
      systemPrompts: compiled.systemPrompts,
      modelOptions: {
        ...compiled.modelOptions,
        ...(compiled.stop ? { stop: compiled.stop } : {}),
      },
      tools: readTools,
      context: toolContext,
      threadId: input.chatId,
      runId: job.id,
      middleware: [withPersistence(aiPersistence)],
    });

    for await (const chunk of stream) {
      if (chunk.type === "TEXT_MESSAGE_CONTENT") text += chunk.delta ?? "";
      if (chunk.type === "RUN_FINISHED") {
        const reason = finishReasonOf(chunk);
        if (reason === "tool_calls") continue;
        finishReason = reason;
        usage = (Array.isArray(chunk.usage) ? chunk.usage[0] : chunk.usage) as TokenUsage | undefined;
      }
      if (chunk.type === "RUN_ERROR") {
        throw new Error(chunk.message);
      }
    }

    if (!text.trim()) {
      throw new EmptyResponseError({
        message: "The model returned no text.",
        finishReason,
      });
    }

    const kind =
      input.trigger === "impersonate"
        ? "impersonate"
        : input.trigger === "image"
          ? "image"
          : input.trigger === "rewrite"
            ? "rewrite"
            : "transform";
    const finalText =
      kind === "image"
        ? assembleImagePrompt(snapshot.character, text)
        : kind === "impersonate"
          ? sanitizeImpersonation(text, snapshot.persona.name)
          : text.trim();
    const target = (job.target ?? {}) as Record<string, unknown>;
    const targetLocalId =
      typeof target.messageLocalId === "number"
        ? target.messageLocalId
        : input.messageLocalId ?? null;
    const targetRole =
      targetLocalId != null
        ? getMessages(input.chatId, db).find((message) => message.localId === targetLocalId)?.role
        : undefined;

    const proposalId = await runGeneration(
      withGenerationService((service) =>
        service.propose({
          jobId: job.id,
          chatId: input.chatId,
          kind,
          content: finalText,
          targetLocalId,
          baseRev: typeof target.baseRev === "number" ? target.baseRev : null,
          baseHash: typeof target.baseHash === "string" ? target.baseHash : null,
          role: targetRole === "user" || targetRole === "assistant" ? targetRole : "assistant",
          meta: {
            instruction: input.instruction ?? null,
            selection,
            finishReason,
            usage: usage ?? null,
          },
        }),
      ),
    );

    await runGeneration(
      withGenerationService((service) =>
        service.finalizeProposal({
          jobId: job.id,
          owner,
          epoch: lease.epoch,
          proposalId,
          usage,
          finishReason,
        }),
      ),
    );

    // Impersonation drafts and image prompts are reviewed directly in the
    // composer/result panel; they do not need a separate accept step.
    if (kind === "impersonate" || kind === "image") {
      resolveProposal(proposalId, "accepted", db);
    }

    return { jobId: job.id, proposalId, text: finalText };
  } catch (error) {
    await runGeneration(
      withGenerationService((service) =>
        service.fail({
          jobId: job.id,
          owner,
          code: "proposal_failed",
          message: error instanceof Error ? error.message : String(error),
          usage,
          finishReason,
        }),
      ),
    ).catch(() => {});
    throw error;
  }
}

export type ProposalError = GenerationError;
