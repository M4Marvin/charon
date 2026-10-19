import { asc, eq } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import { aiProviders, userSettings, type AiProvider, type NewAiProvider } from "@/db/schema";
import { encryptApiKey, decryptApiKey } from "@/lib/crypto";

async function decryptProvider(row: AiProvider): Promise<AiProvider> {
  return { ...row, apiKey: await decryptApiKey(row.apiKey) };
}

export type CreateAiProviderInput = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel?: string | null;
  defaultHeaders?: Record<string, string> | null;
};

export type UpdateAiProviderInput = {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string | null;
  defaultHeaders?: Record<string, string> | null;
};

export async function listAiProviders(db: DB = defaultDb): Promise<AiProvider[]> {
  const rows = db.select().from(aiProviders).orderBy(asc(aiProviders.name)).all();
  return Promise.all(rows.map(decryptProvider));
}

export async function getAiProvider(id: string, db: DB = defaultDb): Promise<AiProvider> {
  const row = db.select().from(aiProviders).where(eq(aiProviders.id, id)).get();
  if (!row) throw new Error("Provider not found");
  return decryptProvider(row);
}

export async function createAiProvider(
  input: CreateAiProviderInput,
  db: DB = defaultDb,
): Promise<AiProvider> {
  const row: NewAiProvider = {
    id: input.id,
    name: input.name,
    baseUrl: input.baseUrl,
    apiKey: await encryptApiKey(input.apiKey),
    defaultModel: input.defaultModel ?? null,
    defaultHeaders: input.defaultHeaders ?? null,
  };
  return db.insert(aiProviders).values(row).returning().get();
}

export async function updateAiProvider(
  id: string,
  patch: UpdateAiProviderInput,
  db: DB = defaultDb,
): Promise<AiProvider> {
  const existing = await getAiProvider(id, db);
  const updates: Partial<NewAiProvider> = { updatedAt: new Date() };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.baseUrl !== undefined) updates.baseUrl = patch.baseUrl;
  if (patch.apiKey !== undefined) updates.apiKey = await encryptApiKey(patch.apiKey);
  if (patch.defaultModel !== undefined) updates.defaultModel = patch.defaultModel;
  if (patch.defaultHeaders !== undefined) updates.defaultHeaders = patch.defaultHeaders;
  const row = db
    .update(aiProviders)
    .set(updates)
    .where(eq(aiProviders.id, existing.id))
    .returning()
    .get();
  if (!row) throw new Error("Provider not found");
  return decryptProvider(row);
}

export async function deleteAiProvider(id: string, db: DB = defaultDb): Promise<void> {
  const existing = await getAiProvider(id, db);
  db.delete(aiProviders).where(eq(aiProviders.id, existing.id)).run();
}

/**
 * Delete a provider and repair the account defaults in one transaction.
 * The FK clears `default_provider_id`; the selected model has no FK and must be
 * cleared explicitly or Defaults would keep pointing at a model whose provider
 * is gone.
 */
export function deleteAiProviderAndRepair(id: string, db: DB = defaultDb): { wasDefault: boolean } {
  return db.transaction((tx) => {
    const existing = tx.select().from(aiProviders).where(eq(aiProviders.id, id)).get();
    if (!existing) throw new Error("Provider not found");

    const affected = tx
      .select()
      .from(userSettings)
      .where(eq(userSettings.defaultProviderId, id))
      .get();

    if (affected) {
      tx.update(userSettings)
        .set({ defaultProviderId: null, defaultSelectedModel: null, updatedAt: new Date() })
        .where(eq(userSettings.userId, affected.userId))
        .run();
    }

    tx.delete(aiProviders).where(eq(aiProviders.id, existing.id)).run();
    return { wasDefault: Boolean(affected) };
  });
}
