import { and, asc, eq } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import { aiProviders, type AiProvider, type NewAiProvider } from "@/db/schema";

export type CreateAiProviderInput = {
  id: string;
  userId: string;
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

export function listAiProviders(userId: string, db: DB = defaultDb): AiProvider[] {
  return db
    .select()
    .from(aiProviders)
    .where(eq(aiProviders.userId, userId))
    .orderBy(asc(aiProviders.name))
    .all();
}

export function getAiProvider(userId: string, id: string, db: DB = defaultDb): AiProvider {
  const row = db
    .select()
    .from(aiProviders)
    .where(and(eq(aiProviders.id, id), eq(aiProviders.userId, userId)))
    .get();
  if (!row) throw new Error("Provider not found");
  return row;
}

export function createAiProvider(input: CreateAiProviderInput, db: DB = defaultDb): AiProvider {
  const row: NewAiProvider = {
    id: input.id,
    userId: input.userId,
    name: input.name,
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    defaultModel: input.defaultModel ?? null,
    defaultHeaders: input.defaultHeaders ?? null,
  };
  return db.insert(aiProviders).values(row).returning().get();
}

export function updateAiProvider(
  userId: string,
  id: string,
  patch: UpdateAiProviderInput,
  db: DB = defaultDb,
): AiProvider {
  const existing = getAiProvider(userId, id, db);
  const updates: Partial<NewAiProvider> = { updatedAt: new Date() };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.baseUrl !== undefined) updates.baseUrl = patch.baseUrl;
  if (patch.apiKey !== undefined) updates.apiKey = patch.apiKey;
  if (patch.defaultModel !== undefined) updates.defaultModel = patch.defaultModel;
  if (patch.defaultHeaders !== undefined) updates.defaultHeaders = patch.defaultHeaders;
  const row = db
    .update(aiProviders)
    .set(updates)
    .where(and(eq(aiProviders.id, existing.id), eq(aiProviders.userId, userId)))
    .returning()
    .get();
  if (!row) throw new Error("Provider not found");
  return row;
}

export function deleteAiProvider(userId: string, id: string, db: DB = defaultDb): void {
  const existing = getAiProvider(userId, id, db);
  db.delete(aiProviders)
    .where(and(eq(aiProviders.id, existing.id), eq(aiProviders.userId, userId)))
    .run();
}
