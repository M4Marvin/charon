import { asc, sql } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import type { ChatCompletionPreset } from "@/lib/chat/types";
import type { ResolvedProvider } from "./types";
import type { UserSettingsView } from "./types";
import { aiProviders } from "@/db/schema";
import { getAiProvider } from "@/db/repositories/aiProviders";
import { getPreset } from "@/db/repositories/presets";
import { createLogger } from "@/features/logging";

const log = createLogger("chat:gen:provider");

/**
 * Pick the ai_providers row per the pinned resolution order:
 * 1. settings.defaultProviderId IF that row exists
 * 2. else the provider with the earliest created_at (tie-break rowid ASC)
 * 3. else null
 * A stale defaultProviderId (deleted provider) falls through to (2)/(3).
 */
async function pickProviderRow(
  settings: UserSettingsView | null,
  db: DB,
): Promise<Awaited<ReturnType<typeof getAiProvider>> | null> {
  if (settings?.defaultProviderId) {
    try {
      return await getAiProvider(settings.defaultProviderId, db);
    } catch {
      // stale defaultProviderId — fall through to earliest-created
    }
  }
  const first = db
    .select({ id: aiProviders.id })
    .from(aiProviders)
    .orderBy(asc(aiProviders.createdAt), sql`rowid ASC`)
    .all();
  if (first.length === 0) return null;
  return await getAiProvider(first[0].id, db);
}

/**
 * Resolve the provider + model to use, or null when the user has no usable
 * configuration (no provider row, or a provider with no resolvable model).
 * This is deliberately non-throwing: a missing model is a soft, user-fixable
 * state, so chat config must still load and the page must still render.
 * Generation surfaces the missing provider at call time.
 */
export async function resolveProvider(
  settings: UserSettingsView | null,
  db: DB = defaultDb,
): Promise<ResolvedProvider | null> {
  log.debug("resolveProvider start");

  const provider = await pickProviderRow(settings, db);
  if (!provider) {
    log.info("resolveProvider: no provider configured");
    return null;
  }

  const model = settings?.defaultSelectedModel ?? provider.defaultModel;
  if (!model) {
    log.warn("resolveProvider: no model configured", {
      settingsModel: settings?.defaultSelectedModel ?? null,
      providerModel: provider.defaultModel,
    });
    return null;
  }

  let preset: Partial<ChatCompletionPreset> = {};
  if (settings?.defaultPresetId) {
    try {
      const dbPreset = getPreset(settings.defaultPresetId, db);
      const d = dbPreset.data as Record<string, unknown> | null;
      if (d) {
        if (d.systemPrompt !== undefined) preset.systemPrompt = d.systemPrompt as string;
        if (d.temperature !== undefined) preset.temperature = d.temperature as number;
        if (d.maxTokens !== undefined) preset.maxResponseLength = d.maxTokens as number;
        if (d.topP !== undefined) preset.topP = d.topP as number;
        if (d.contextSize !== undefined) preset.contextSize = d.contextSize as number;
        if (d.frequencyPenalty !== undefined)
          preset.frequencyPenalty = d.frequencyPenalty as number;
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
