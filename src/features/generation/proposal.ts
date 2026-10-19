import { chat as aiChat, type StreamChunk, type TokenUsage } from "@tanstack/ai";
import { db as defaultDb, type DB } from "@/db";
import {
  beginJob,
  createProposal,
  failJob,
  finalizeJob,
  getJob,
  heartbeatJob,
  resolveProposal,
} from "@/db/repositories/generation";
import { getMessages } from "@/features/chat/tree/service";
import { loadGenerationSnapshot } from "./context";
import { compilePrompt } from "./prompt";
import { makeAdapter } from "./provider";
import { readTools } from "./tools";
import { prepareGeneration } from "./prepare";
import { EmptyResponseError, LeaseLostError, type GenerationError } from "./errors";
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
  let job: ReturnType<typeof getJob> | undefined;
  let owner: string | undefined;
  let leaseAcquired = false;
  let leaseLost = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let text = "";
  let usage: TokenUsage | undefined;
  let finishReason: string | null = null;

  try {
    job = getJob(prepared.jobId, db);
    if (!job) throw new Error("Generation job not found");

    const storedSelection = job.input?.selection;
    const selection =
      Array.isArray(storedSelection) && storedSelection.length > 0
        ? (storedSelection as number[])
        : input.selection?.length
          ? input.selection
          : input.messageLocalId
            ? [input.messageLocalId]
            : [];
    const instruction =
      typeof job.input?.instruction === "string" ? job.input.instruction : input.instruction;
    const snapshot = await loadGenerationSnapshot(userId, input.chatId, 0, selection, db);
    const compiled = compilePrompt(snapshot, job.promptMode, { instruction });
    const adapter = makeAdapter(snapshot.provider);
    owner = crypto.randomUUID();
    const leaseOwner = owner;
    const lease = beginJob({ jobId: job.id, owner: leaseOwner }, db);
    leaseAcquired = true;
    heartbeat = setInterval(() => {
      try {
        if (!heartbeatJob({ jobId: job!.id, owner: leaseOwner, ttlMs: 120_000 }, db)) {
          leaseLost = true;
        }
      } catch {
        leaseLost = true;
      }
    }, 30_000);
    const toolContext: ToolContext = {
      userId,
      chatId: input.chatId,
    };

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
    });

    for await (const chunk of stream) {
      if (leaseLost) {
        throw new LeaseLostError({
          message: "The generation lease was lost while streaming.",
          jobId: job.id,
        });
      }
      if (chunk.type === "TEXT_MESSAGE_CONTENT") text += chunk.delta ?? "";
      if (chunk.type === "RUN_FINISHED") {
        const reason = finishReasonOf(chunk);
        if (reason === "tool_calls") continue;
        finishReason = reason;
        usage = (Array.isArray(chunk.usage) ? chunk.usage[0] : chunk.usage) as
          | TokenUsage
          | undefined;
      }
      if (chunk.type === "RUN_ERROR") {
        throw new Error(chunk.message);
      }
    }

    if (leaseLost) {
      throw new LeaseLostError({
        message: "The generation lease was lost while streaming.",
        jobId: job.id,
      });
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
          ? sanitizeImpersonation(text, snapshot.persona.name, snapshot.character.name)
          : text.trim();
    const target = (job.target ?? {}) as Record<string, unknown>;
    const targetLocalId =
      typeof target.messageLocalId === "number"
        ? target.messageLocalId
        : (input.messageLocalId ?? null);
    const targetRole =
      targetLocalId != null
        ? getMessages(input.chatId, db).find((message) => message.localId === targetLocalId)?.role
        : undefined;

    const proposal = createProposal(
      {
        jobId: job.id,
        chatId: input.chatId,
        kind,
        proposedContent: finalText,
        targetLocalId,
        baseRev: typeof target.baseRev === "number" ? target.baseRev : null,
        baseHash: typeof target.baseHash === "string" ? target.baseHash : null,
        proposedRole:
          kind === "transform"
            ? "assistant"
            : targetRole === "user" || targetRole === "assistant"
              ? targetRole
              : "assistant",
        meta: {
          instruction: input.instruction ?? null,
          selection,
          finishReason,
          usage: usage ?? null,
        },
      },
      db,
    );

    const finalized = finalizeJob(
      {
        jobId: job.id,
        owner: leaseOwner,
        epoch: lease.leaseEpoch,
        usage: usage as unknown as Record<string, unknown> | undefined,
        finishReason,
      },
      db,
    );
    if (!finalized) throw new Error("The generation lease was lost before proposal finalize.");

    // Impersonation drafts, image prompts, and selection prompts are consumed
    // directly in the composer; they do not need a separate accept step.
    if (kind === "impersonate" || kind === "image" || kind === "transform") {
      resolveProposal(proposal.id, "accepted", db);
    }

    return { jobId: job.id, proposalId: proposal.id, text: finalText };
  } catch (error) {
    failJob(
      {
        jobId: prepared.jobId,
        owner: leaseAcquired ? owner : undefined,
        code: "proposal_failed",
        message: error instanceof Error ? error.message : String(error),
        usage: usage as unknown as Record<string, unknown> | undefined,
        finishReason,
      },
      db,
    );
    throw error;
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

export type ProposalError = GenerationError;
