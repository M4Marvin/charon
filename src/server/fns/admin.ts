import { createServerFn } from "@tanstack/react-start";
import { type } from "arktype";
import { getSession } from "@/server/session";
import { getGlobalAiProvider, upsertGlobalAiProvider } from "@/db/repositories/aiProviders";

export const getGlobalAiConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { user } = await getSession();
  if (user.username !== "marv") throw new Error("Forbidden");
    const provider = await getGlobalAiProvider();
  return {
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    defaultModel: provider.defaultModel,
    defaultHeaders: provider.defaultHeaders,
  };
});

const UpdateGlobalAiInput = type({
  baseUrl: "string > 0",
  apiKey: "string",
  "defaultModel?": "string",
  "defaultHeaders?": "object",
});

export const updateGlobalAiConfig = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const result = UpdateGlobalAiInput(data);
    if (result instanceof type.errors) throw new Error(result.summary);
    return result;
  })
  .handler(async ({ data }) => {
    const { user } = await getSession();
    if (user.username !== "marv") throw new Error("Forbidden");
    await upsertGlobalAiProvider({
      name: "Built-in",
      baseUrl: data.baseUrl,
      apiKey: data.apiKey,
      defaultModel: data.defaultModel ?? null,
      defaultHeaders: (data.defaultHeaders as Record<string, string> | null) ?? null,
    });
    return { ok: true };
  });
