import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/server/session";
import { validateId } from "@/server/validators";
import type { Preset } from "@/db/schema";
import {
  createPreset as repoCreate,
  deletePresetAndRepair as repoDeleteAndRepair,
  getPreset as repoGet,
  listPresets as repoList,
  updatePreset as repoUpdate,
  type CreatePresetInput,
  type UpdatePresetInput,
} from "@/db/repositories/presets";
import { validateCreatePresetInput, validateUpdatePresetInput } from "@/server/preset-input";

export type PresetListItem = Preset;

// ── Server functions ────────────────────────────────────────────────────────

export const listPresets = createServerFn({ method: "GET", strict: { output: false } }).handler(
  async (): Promise<PresetListItem[]> => {
    await getSession();
    return repoList();
  },
);

export const getPreset = createServerFn({ method: "GET", strict: { output: false } })
  .validator(validateId)
  .handler(async ({ data }): Promise<Preset> => {
    await getSession();
    return repoGet(data.id);
  });

export const createPreset = createServerFn({ method: "POST" })
  .validator(validateCreatePresetInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    await getSession();
    const id = randomUUID();
    const input: CreatePresetInput = {
      id,
      name: data.name,
      providerId: data.providerId,
      model: data.model,
      data: data.data,
    };
    repoCreate(input);
    return { id };
  });

export const updatePreset = createServerFn({ method: "POST", strict: { output: false } })
  .validator(validateUpdatePresetInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    await getSession();
    const patch: UpdatePresetInput = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.providerId !== undefined) patch.providerId = data.providerId;
    if (data.model !== undefined) patch.model = data.model;
    if (data.data !== undefined) patch.data = data.data;
    repoUpdate(data.id, patch);
    return { id: data.id };
  });

export const deletePreset = createServerFn({ method: "POST" })
  .validator(validateId)
  .handler(async ({ data }): Promise<{ id: string; wasDefault: boolean }> => {
    await getSession();
    const { wasDefault } = repoDeleteAndRepair(data.id);
    return { id: data.id, wasDefault };
  });
