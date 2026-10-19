import { createFileRoute } from "@tanstack/react-router";
import {
  chat as aiChat,
  memoryStream,
  toServerSentEventsResponse,
  type StreamChunk,
  type TokenUsage,
} from "@tanstack/ai";
import { tryGetSession } from "@/server/session";
import { beginJob, failJob, getJob, heartbeatJob } from "@/db/repositories/generation";
import { loadGenerationSnapshot } from "@/features/generation/context";
import { compilePrompt } from "@/features/generation/prompt";
import { makeAdapter } from "@/features/generation/provider";
import { readTools } from "@/features/generation/tools";
import { finalizeChat } from "@/features/generation/finalize";
import { httpStatusFor, isGenerationError, toErrorBody } from "@/features/generation/errors";
import type { ToolContext } from "@/features/generation/contract";
import { createLogger } from "@/features/logging";

const log = createLogger("api:generation:chat");

async function* noStream(): AsyncGenerator<StreamChunk> {}

function finishReasonOf(chunk: StreamChunk): string | null {
  const value = chunk as unknown as {
    finishReason?: string | null;
    metadata?: { tanstack?: { finishReason?: string | null } };
  };
  return value.finishReason ?? value.metadata?.tanstack?.finishReason ?? null;
}

async function* finalizeOnTerminal(
  jobId: string,
  owner: string,
  epoch: number,
  stream: AsyncIterable<StreamChunk>,
): AsyncGenerator<StreamChunk> {
  let text = "";
  let terminal = false;
  let usage: TokenUsage | undefined;
  let finishReason: string | null = null;
  const heartbeat = setInterval(() => {
    try {
      heartbeatJob({ jobId, owner, ttlMs: 120_000 });
    } catch {
      // The lease may already be finalized or reclaimed; the terminal path
      // below reports the real outcome.
    }
  }, 30_000);

  try {
    for await (const chunk of stream) {
      if (chunk.type === "TEXT_MESSAGE_CONTENT") text += chunk.delta ?? "";

      if (chunk.type === "RUN_FINISHED") {
        const reason = finishReasonOf(chunk);
        if (reason === "tool_calls") {
          yield chunk;
          continue;
        }
        terminal = true;
        usage = (Array.isArray(chunk.usage) ? chunk.usage[0] : chunk.usage) as
          | TokenUsage
          | undefined;
        finishReason = reason;
        finalizeChat({ jobId, owner, epoch, text, usage, finishReason });
        yield chunk;
        continue;
      }

      if (chunk.type === "RUN_ERROR") {
        terminal = true;
        failJob({
          jobId,
          owner,
          code: "provider_error",
          message: chunk.message,
          usage: usage as unknown as Record<string, unknown> | undefined,
          finishReason,
        });
        yield chunk;
        continue;
      }

      yield chunk;
    }

    if (!terminal) {
      failJob({
        jobId,
        owner,
        code: "incomplete_stream",
        message: "The provider stream ended without a terminal event.",
        usage: usage as unknown as Record<string, unknown> | undefined,
        finishReason,
      });
    }
  } catch (error) {
    try {
      failJob({
        jobId,
        owner,
        code: "finalize_failed",
        message: error instanceof Error ? error.message : String(error),
        usage: usage as unknown as Record<string, unknown> | undefined,
        finishReason,
      });
    } catch {
      // Preserve the original stream error.
    }
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

export const Route = createFileRoute("/api/generation/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let activeJobId: string | null = null;
        try {
          const session = await tryGetSession();
          if (!session) {
            return new Response(JSON.stringify({ code: "unauthorized", message: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          const { user } = session;
          const durability = memoryStream(request);
          if (durability.resumeFrom() !== null) {
            return toServerSentEventsResponse(noStream(), {
              durability: { adapter: durability },
            });
          }
          const body = (await request.json()) as Record<string, unknown>;
          const data = (body.data ?? body.forwardedProps ?? body) as Record<string, unknown>;
          const jobId = String(data.jobId ?? "");
          if (!jobId) {
            return new Response(
              JSON.stringify({ code: "invalid_request", message: "jobId is required" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const job = getJob(jobId);
          if (!job) {
            return new Response(
              JSON.stringify({ code: "not_found", message: "Generation job not found" }),
              {
                status: 404,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
          activeJobId = job.id;

          const storedSelection = job.input?.selection;
          const selectionIds =
            Array.isArray(storedSelection) && storedSelection.length > 0
              ? (storedSelection as number[])
              : job.target?.kind === "replace"
                ? [Number(job.target.messageLocalId)]
                : [];
          const snapshot = await loadGenerationSnapshot(
            user.id,
            job.chatId,
            job.placeholderLocalId ?? 0,
            selectionIds,
          );
          const instruction =
            typeof job.input?.instruction === "string" ? job.input.instruction : undefined;
          const compiled = compilePrompt(snapshot, job.promptMode, { instruction });
          const adapter = makeAdapter(snapshot.provider);
          const tools = readTools;
          const owner = crypto.randomUUID();
          const lease = beginJob({ jobId: job.id, owner });

          const toolContext: ToolContext = {
            userId: user.id,
            chatId: job.chatId,
          };

          const stream = aiChat({
            adapter,
            messages: compiled.messages,
            systemPrompts: compiled.systemPrompts,
            modelOptions: {
              ...compiled.modelOptions,
              ...(compiled.stop ? { stop: compiled.stop } : {}),
            },
            tools,
            context: toolContext,
            threadId: job.chatId,
            runId: job.id,
          });

          const finalized = finalizeOnTerminal(job.id, owner, lease.leaseEpoch, stream);
          return toServerSentEventsResponse(finalized, {
            durability: { adapter: durability },
            headers: {
              "Cache-Control": "no-cache, no-transform",
              "X-Accel-Buffering": "no",
            },
          });
        } catch (error) {
          const generationError = isGenerationError(error) ? error : null;
          const message = error instanceof Error ? error.message : "Generation failed";
          const status = generationError ? httpStatusFor(generationError) : 500;
          const body = generationError
            ? toErrorBody(generationError)
            : { code: "internal", message };
          log.error("generation chat failed", {
            tag: generationError?._tag,
            message,
            status,
          });
          if (activeJobId) {
            try {
              failJob({ jobId: activeJobId, code: body.code, message });
            } catch {
              // Best effort: the job may already be terminal.
            }
          }
          return new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
