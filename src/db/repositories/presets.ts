import { and, asc, eq } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import { presets, type NewPreset, type Preset } from "@/db/schema";

export type PresetData = {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  contextSize?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
};

export type CreatePresetInput = {
  id: string;
  userId: string;
  name: string;
  providerId?: string | null;
  model?: string | null;
  data: PresetData;
};

export type UpdatePresetInput = {
  name?: string;
  providerId?: string | null;
  model?: string | null;
  data?: PresetData;
};

export function listPresets(userId: string, db: DB = defaultDb): Preset[] {
  return db
    .select()
    .from(presets)
    .where(eq(presets.userId, userId))
    .orderBy(asc(presets.name))
    .all();
}

export function getPreset(userId: string, id: string, db: DB = defaultDb): Preset {
  const row = db
    .select()
    .from(presets)
    .where(and(eq(presets.id, id), eq(presets.userId, userId)))
    .get();
  if (!row) throw new Error("Preset not found");
  return row;
}

export function createPreset(input: CreatePresetInput, db: DB = defaultDb): Preset {
  const row: NewPreset = {
    id: input.id,
    userId: input.userId,
    name: input.name,
    providerId: input.providerId ?? null,
    model: input.model ?? null,
    data: input.data,
  };
  return db.insert(presets).values(row).returning().get();
}

export function updatePreset(
  userId: string,
  id: string,
  patch: UpdatePresetInput,
  db: DB = defaultDb,
): Preset {
  const existing = getPreset(userId, id, db);
  const updates: Partial<NewPreset> = { updatedAt: new Date() };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.providerId !== undefined) updates.providerId = patch.providerId;
  if (patch.model !== undefined) updates.model = patch.model;
  if (patch.data !== undefined) updates.data = patch.data;
  const row = db
    .update(presets)
    .set(updates)
    .where(and(eq(presets.id, existing.id), eq(presets.userId, userId)))
    .returning()
    .get();
  if (!row) throw new Error("Preset not found");
  return row;
}

export function deletePreset(userId: string, id: string, db: DB = defaultDb): void {
  const existing = getPreset(userId, id, db);
  db.delete(presets)
    .where(and(eq(presets.id, existing.id), eq(presets.userId, userId)))
    .run();
}
