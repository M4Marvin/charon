import { createFileRoute } from "@tanstack/react-router";
import {
  chat as aiChat,
  memoryStream,
  toServerSentEventsResponse,
  type StreamChunk,
  type TokenUsage,
} from "@tanstack/ai";
import { reconstructChat, withPersistence } from "@tanstack/ai-persistence";
import { tryGetSession } from "@/server/session";
import { getJob, getJobByRequestId } from "@/db/repositories/generation";
import { aiPersistence } from "@/features/generation/persistence-singleton";
import { loadGenerationSnapshot } from "@/features/generation/context";
import { compilePrompt } from "@/features/generation/prompt";
import { makeAdapter } from "@/features/generation/provider";
import { readTools } from "@/features/generation/tools";
import { runGeneration, withGenerationService } from "@/features/generation/service";
import type { GenerationError } from "@/features/generation/errors";
import type { ToolContext } from "@/features/generation/contract";
import { createLogger } from "@/features/logging";

const log = createLogger("api:generation:chat");

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
        usage = (Array.isArray(chunk.usage) ? chunk.usage[0] : chunk.usage) as TokenUsage | undefined;
        finishReason = reason;
        await runGeneration(
          withGenerationService((service) =>
            service.finalizeChat({ jobId, owner, epoch, text, usage, finishReason }),
          ),
        );
        yield chunk;
        continue;
      }

      if (chunk.type === "RUN_ERROR") {
        terminal = true;
        await runGeneration(
          withGenerationService((service) =>
            service.fail({
              jobId,
              owner,
              code: "provider_error",
              message: chunk.message,
              usage,
              finishReason,
            }),
          ),
        );
        yield chunk;
        continue;
      }

      yield chunk;
    }

    if (!terminal) {
      await runGeneration(
        withGenerationService((service) =>
          service.fail({
            jobId,
            owner,
            code: "incomplete_stream",
            message: "The provider stream ended without a terminal event.",
            usage,
            finishReason,
          }),
        ),
      );
    }
  } catch (error) {
    await runGeneration(
      withGenerationService((service) =>
        service.fail({
          jobId,
          owner,
          code: "finalize_failed",
          message: error instanceof Error ? error.message : String(error),
          usage,
          finishReason,
        }),
      ),
    ).catch(() => {});
    throw error;
  }
}

export const Route = createFileRoute("/api/generation/chat")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await tryGetSession();
        if (!session) {
          return new Response(JSON.stringify({ code: "unauthorized", message: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        return reconstructChat(aiPersistence, request, {
          authorize: async () => true,
        });
      },
      POST: async ({ request }) => {
        try {
          const session = await tryGetSession();
          if (!session) {
            return new Response(JSON.stringify({ code: "unauthorized", message: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          const { user } = session;
          const body = (await request.json()) as Record<string, unknown>;
          const data = (body.data ?? body.forwardedProps ?? body) as Record<string, unknown>;
          const jobId = String(data.jobId ?? "");
          if (!jobId) {
            return new Response(JSON.stringify({ code: "invalid_request", message: "jobId is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const job = getJob(jobId) ?? getJobByRequestId(jobId);
          if (!job) {
            return new Response(JSON.stringify({ code: "not_found", message: "Generation job not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          const selectionIds = Array.isArray(job.input?.selection)
            ? (job.input?.selection as number[])
            : job.target?.kind === "replace"
              ? [Number(job.target.messageLocalId)]
              : [];
          const snapshot = await loadGenerationSnapshot(
            user.id,
            job.chatId,
            job.placeholderLocalId ?? 0,
            selectionIds,
          );
          const compiled = compilePrompt(snapshot, job.promptMode);
          const adapter = makeAdapter(snapshot.provider);
          const tools = readTools;
          const owner = crypto.randomUUID();
          const lease = await runGeneration(
            withGenerationService((service) => service.begin(job.id, owner)),
          );

          const toolContext: ToolContext = {
            userId: user.id,
            chatId: job.chatId,
            jobId: job.id,
            mode: job.promptMode,
            baseLeafId: job.baseLeafId ?? 0,
            selection: selectionIds,
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
            middleware: [withPersistence(aiPersistence)],
          });

          const finalized = finalizeOnTerminal(job.id, owner, lease.epoch, stream);
          return toServerSentEventsResponse(finalized, {
            durability: { adapter: memoryStream(request) },
            headers: {
              "Cache-Control": "no-cache, no-transform",
              "X-Accel-Buffering": "no",
            },
          });
        } catch (error) {
          const err = error as GenerationError & { _tag?: string };
          log.error("generation chat failed", {
            tag: err?._tag,
            message: err instanceof Error ? err.message : String(error),
          });
          return new Response(
            JSON.stringify({
              code: err?._tag ?? "internal",
              message: err instanceof Error ? err.message : "Generation failed",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
