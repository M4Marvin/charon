import type { StreamChunk } from "@tanstack/ai";
import { chat as effectChat } from "@tanstack/ai-effect";
import { Stream } from "effect";
import type { DB } from "@/db";
import type { ResolvedProvider } from "@/features/chat/config/types";
import type { CompiledPrompt } from "./contract";
import { makeAdapter } from "./provider";
import { makeReadToolLayer, readTools } from "./tools";

export interface GenerationStreamInput {
  provider: ResolvedProvider;
  compiled: CompiledPrompt;
  userId: string;
  chatId: string;
  jobId: string;
  db?: DB;
}

/**
 * One Effect-native provider stream: typed errors and interruption come from
 * `@tanstack/ai-effect`; the request DB/user/chat arrive as the read-tool Layer.
 * The app's job/lease/finalize wrapper still consumes the resulting async
 * iterable, so durable finalization is unchanged.
 */
export function makeGenerationStream(input: GenerationStreamInput): AsyncIterable<StreamChunk> {
  const stream = effectChat({
    adapter: makeAdapter(input.provider),
    messages: input.compiled.messages,
    systemPrompts: input.compiled.systemPrompts,
    modelOptions: {
      ...input.compiled.modelOptions,
      ...(input.compiled.stop ? { stop: input.compiled.stop } : {}),
    },
    tools: readTools,
    threadId: input.chatId,
    runId: input.jobId,
  }).pipe(
    Stream.provide(
      makeReadToolLayer({
        db: input.db,
        userId: input.userId,
        chatId: input.chatId,
      }),
    ),
  );
  return Stream.toAsyncIterable(stream);
}
