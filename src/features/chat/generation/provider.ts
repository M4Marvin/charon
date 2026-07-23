import { db as defaultDb, type DB } from "@/db";
import type { ChatCompletionPreset } from "@/lib/chat/types";
import type { ResolvedProvider } from "./types";
import { getUserSettings } from "@/db/repositories/userSettings";
import { getAiProviderWithGlobalFallback } from "@/db/repositories/aiProviders";
import { getPreset } from "@/db/repositories/presets";
import { createLogger } from "@/features/logging";

const log = createLogger("chat:gen:provider");

export async function resolveProvider(
  userId: string,
  db: DB = defaultDb,
): Promise<ResolvedProvider> {
  log.debug("resolveProvider start", { userId });

  const settings = getUserSettings(userId, db);
  if (!settings?.defaultProviderId) {
    log.info("resolveProvider: no provider configured");
    throw new Error("No provider configured");
  }

  const provider = await getAiProviderWithGlobalFallback(
    userId,
    settings.defaultProviderId,
    db,
  );

  const model = settings.defaultSelectedModel ?? provider.defaultModel;
  if (!model) {
    log.error("resolveProvider: no model configured", { settingsModel: settings.defaultSelectedModel, providerModel: provider.defaultModel });
    throw new Error("No model configured");
  }

  let preset: Partial<ChatCompletionPreset> = {};
  if (settings.defaultPresetId) {
    try {
      const dbPreset = getPreset(userId, settings.defaultPresetId, db);
      const d = dbPreset.data as Record<string, unknown> | null;
      if (d) {
        if (d.systemPrompt !== undefined) preset.systemPrompt = d.systemPrompt as string;
        if (d.temperature !== undefined) preset.temperature = d.temperature as number;
        if (d.maxTokens !== undefined) preset.maxResponseLength = d.maxTokens as number;
        if (d.topP !== undefined) preset.topP = d.topP as number;
        if (d.contextSize !== undefined) preset.contextSize = d.contextSize as number;
        if (d.frequencyPenalty !== undefined) preset.frequencyPenalty = d.frequencyPenalty as number;
        if (d.presencePenalty !== undefined) preset.presencePenalty = d.presencePenalty as number;
      }
    } catch {
      // preset deleted — fall through to defaults
    }
  }

  log.info("resolveProvider done", {
    model,
    hasPreset: Object.keys(preset).length > 0,
    hasApiKey: provider.apiKey.length > 0,
  });

  return {
    provider: {
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      defaultHeaders: provider.defaultHeaders ?? undefined,
      defaultModel: provider.defaultModel,
    },
    model,
    preset,
  };
}
