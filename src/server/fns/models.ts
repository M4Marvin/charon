import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/server/session";
import { validateId } from "@/server/validators";
import { getAiProviderWithGlobalFallback as repoGet } from "@/db/repositories/aiProviders";
import { probeProviderModels, type ProviderModel, type ProbeResult } from "@/server/services/ai/model-fetcher";

export type { ProviderModel, ProbeResult };

export const listProviderModels = createServerFn({ method: "GET", strict: { output: false } })
  .validator(validateId)
  .handler(async ({ data }): Promise<ProviderModel[]> => {
    const { user } = await getSession();
    const provider = await repoGet(user.id, data.id);

    const result = await probeProviderModels(provider);
    if (!result.ok) throw new Error(result.error ?? "Provider unreachable");
    return result.models;
  });

export const testProviderConnection = createServerFn({ method: "GET" })
  .validator(validateId)
  .handler(async ({ data }): Promise<ProbeResult> => {
    const { user } = await getSession();
    const provider = await repoGet(user.id, data.id);
    return probeProviderModels(provider);
  });
