import { createServerFn } from "@tanstack/react-start";
import { type } from "arktype";
import { Effect } from "effect";
import { getSession } from "@/server/session";
import { validateId } from "@/server/validators";
import { getAiProviderWithGlobalFallback as repoGet } from "@/db/repositories/aiProviders";
import {
  probeProviderModels,
  type ProviderModel,
  type ProbeResult,
} from "@/server/services/ai/model-fetcher";
import {
  testProviderChatCompletion,
  type ChatTestResult,
} from "@/server/services/ai/chat-tester";

export type { ProviderModel, ProbeResult, ChatTestResult };

export const listProviderModels = createServerFn({ method: "GET", strict: { output: false } })
  .validator(validateId)
  .handler(async ({ data }): Promise<ProviderModel[]> => {
    const { user } = await getSession();
    const provider = await repoGet(user.id, data.id);

    const result = await Effect.runPromise(probeProviderModels(provider));
    if (!result.ok) throw new Error(result.error ?? "Provider unreachable");
    return result.models;
  });

export const testProviderConnection = createServerFn({ method: "GET" })
  .validator(validateId)
  .handler(async ({ data }): Promise<ProbeResult> => {
    const { user } = await getSession();
    const provider = await repoGet(user.id, data.id);
    return Effect.runPromise(probeProviderModels(provider));
  });

const TestProviderChatInput = type({
  providerId: "string > 0",
  "model?": "string > 0",
  "message?": "string > 0",
});

export const testProviderChat = createServerFn({ method: "POST" })
  .validator((data) => {
    const result = TestProviderChatInput(data);
    if (result instanceof type.errors) throw new Error("Invalid input");
    return result;
  })
  .handler(async ({ data }): Promise<ChatTestResult> => {
    const { user } = await getSession();
    const provider = await repoGet(user.id, data.providerId);

    const model = data.model?.trim() || provider.defaultModel;
    if (!model) {
      return {
        ok: false,
        latencyMs: 0,
        error: "No model specified and provider has no default model",
      };
    }

    const message = data.message?.trim() || "Reply with the single word: OK";
    return Effect.runPromise(testProviderChatCompletion(provider, model, message));
  });
