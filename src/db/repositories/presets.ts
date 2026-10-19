import { asc, eq } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import { presets, userSettings, type NewPreset, type Preset } from "@/db/schema";

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

export function listPresets(db: DB = defaultDb): Preset[] {
  return db.select().from(presets).orderBy(asc(presets.name)).all();
}

export function getPreset(id: string, db: DB = defaultDb): Preset {
  const row = db.select().from(presets).where(eq(presets.id, id)).get();
  if (!row) throw new Error("Preset not found");
  return row;
}

export function createPreset(input: CreatePresetInput, db: DB = defaultDb): Preset {
  const row: NewPreset = {
    id: input.id,
    name: input.name,
    providerId: input.providerId ?? null,
    model: input.model ?? null,
    data: input.data,
  };
  return db.insert(presets).values(row).returning().get();
}

export function updatePreset(id: string, patch: UpdatePresetInput, db: DB = defaultDb): Preset {
  const existing = getPreset(id, db);
  const updates: Partial<NewPreset> = { updatedAt: new Date() };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.providerId !== undefined) updates.providerId = patch.providerId;
  if (patch.model !== undefined) updates.model = patch.model;
  if (patch.data !== undefined) updates.data = patch.data;
  const row = db.update(presets).set(updates).where(eq(presets.id, existing.id)).returning().get();
  if (!row) throw new Error("Preset not found");
  return row;
}

export function deletePreset(id: string, db: DB = defaultDb): void {
  const existing = getPreset(id, db);
  db.delete(presets).where(eq(presets.id, existing.id)).run();
}

/**
 * Delete a preset and clear the account default in one transaction. Returns
 * whether the deleted preset was the default so the UI can explain the repair.
 */
export function deletePresetAndRepair(id: string, db: DB = defaultDb): { wasDefault: boolean } {
  return db.transaction((tx) => {
    const existing = tx.select().from(presets).where(eq(presets.id, id)).get();
    if (!existing) throw new Error("Preset not found");

    const affected = tx
      .select()
      .from(userSettings)
      .where(eq(userSettings.defaultPresetId, id))
      .get();

    if (affected) {
      tx.update(userSettings)
        .set({ defaultPresetId: null, updatedAt: new Date() })
        .where(eq(userSettings.userId, affected.userId))
        .run();
    }

    tx.delete(presets).where(eq(presets.id, existing.id)).run();
    return { wasDefault: Boolean(affected) };
  });
}
