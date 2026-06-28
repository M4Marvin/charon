import { and, asc, eq, isNull } from "drizzle-orm";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { db as defaultDb, type DB } from "@/db";
import { aiProviders, type AiProvider, type NewAiProvider } from "@/db/schema";

export const GLOBAL_PROVIDER_ID = "00000000-0000-0000-0000-000000000001";

function getEncryptionKey(): string {
  return process.env.ENCRYPTION_KEY ?? "dev-encryption-key-change-in-production!";
}

async function encryptApiKey(plaintext: string): Promise<string> {
  if (!plaintext) return "";
  return symmetricEncrypt({ key: getEncryptionKey(), data: plaintext });
}

async function decryptApiKey(encrypted: string): Promise<string> {
  if (!encrypted) return "";
  try {
    return await symmetricDecrypt({ key: getEncryptionKey(), data: encrypted });
  } catch {
    return encrypted;
  }
}

async function decryptProvider(row: AiProvider): Promise<AiProvider> {
  return { ...row, apiKey: await decryptApiKey(row.apiKey) };
}

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

export async function listAiProviders(userId: string, db: DB = defaultDb): Promise<AiProvider[]> {
  const rows = db
    .select()
    .from(aiProviders)
    .where(eq(aiProviders.userId, userId))
    .orderBy(asc(aiProviders.name))
    .all();
  return Promise.all(rows.map(decryptProvider));
}

export async function getAiProvider(
  userId: string,
  id: string,
  db: DB = defaultDb,
): Promise<AiProvider> {
  const row = db
    .select()
    .from(aiProviders)
    .where(and(eq(aiProviders.id, id), eq(aiProviders.userId, userId)))
    .get();
  if (!row) throw new Error("Provider not found");
  return decryptProvider(row);
}

export async function getAiProviderWithGlobalFallback(
  userId: string,
  id: string,
  db: DB = defaultDb,
): Promise<AiProvider> {
  let row = db
    .select()
    .from(aiProviders)
    .where(and(eq(aiProviders.id, id), eq(aiProviders.userId, userId)))
    .get();
  if (row) return decryptProvider(row);
  row = db
    .select()
    .from(aiProviders)
    .where(and(eq(aiProviders.id, id), isNull(aiProviders.userId)))
    .get();
  if (!row) throw new Error("Provider not found");
  return decryptProvider(row);
}

export async function getGlobalAiProvider(db: DB = defaultDb): Promise<AiProvider> {
  const row = db
    .select()
    .from(aiProviders)
    .where(isNull(aiProviders.userId))
    .get();
  if (!row) throw new Error("Global provider not found");
  return decryptProvider(row);
}

export async function upsertGlobalAiProvider(
  input: {
    name: string;
    baseUrl: string;
    apiKey: string;
    defaultModel?: string | null;
    defaultHeaders?: Record<string, string> | null;
  },
  db: DB = defaultDb,
): Promise<AiProvider> {
  const encrypted = await encryptApiKey(input.apiKey);
  const existing = db
    .select()
    .from(aiProviders)
    .where(isNull(aiProviders.userId))
    .get();

  if (existing) {
    return db
      .update(aiProviders)
      .set({
        name: input.name,
        baseUrl: input.baseUrl,
        apiKey: encrypted,
        defaultModel: input.defaultModel ?? null,
        defaultHeaders: input.defaultHeaders ?? null,
        updatedAt: new Date(),
      })
      .where(isNull(aiProviders.userId))
      .returning()
      .get();
  }

  return db
    .insert(aiProviders)
    .values({
      id: GLOBAL_PROVIDER_ID,
      userId: null,
      name: input.name,
      baseUrl: input.baseUrl,
      apiKey: encrypted,
      defaultModel: input.defaultModel ?? null,
      defaultHeaders: input.defaultHeaders ?? null,
    })
    .returning()
    .get();
}

export async function createAiProvider(input: CreateAiProviderInput, db: DB = defaultDb): Promise<AiProvider> {
  const row: NewAiProvider = {
    id: input.id,
    userId: input.userId,
    name: input.name,
    baseUrl: input.baseUrl,
    apiKey: await encryptApiKey(input.apiKey),
    defaultModel: input.defaultModel ?? null,
    defaultHeaders: input.defaultHeaders ?? null,
  };
  return db.insert(aiProviders).values(row).returning().get();
}

export async function updateAiProvider(
  userId: string,
  id: string,
  patch: UpdateAiProviderInput,
  db: DB = defaultDb,
): Promise<AiProvider> {
  const existing = await getAiProvider(userId, id, db);
  const updates: Partial<NewAiProvider> = { updatedAt: new Date() };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.baseUrl !== undefined) updates.baseUrl = patch.baseUrl;
  if (patch.apiKey !== undefined) updates.apiKey = await encryptApiKey(patch.apiKey);
  if (patch.defaultModel !== undefined) updates.defaultModel = patch.defaultModel;
  if (patch.defaultHeaders !== undefined) updates.defaultHeaders = patch.defaultHeaders;
  const row = db
    .update(aiProviders)
    .set(updates)
    .where(and(eq(aiProviders.id, existing.id), eq(aiProviders.userId, userId)))
    .returning()
    .get();
  if (!row) throw new Error("Provider not found");
  return decryptProvider(row);
}

export async function deleteAiProvider(userId: string, id: string, db: DB = defaultDb): Promise<void> {
  const existing = await getAiProvider(userId, id, db);
  db.delete(aiProviders)
    .where(and(eq(aiProviders.id, existing.id), eq(aiProviders.userId, userId)))
    .run();
}
