import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { type } from "arktype";
import { getSession } from "@/server/session";
import type { Preset } from "@/db/schema";
import {
  createPreset as repoCreate,
  deletePreset as repoDelete,
  getPreset as repoGet,
  listPresets as repoList,
  updatePreset as repoUpdate,
  type CreatePresetInput,
  type PresetData,
  type UpdatePresetInput,
} from "@/db/repositories/presets";

export type PresetListItem = Preset;

// ── Validators ──────────────────────────────────────────────────────────────

const IdInput = type({ id: "string > 0" });

const PresetDataInput = type({
  "systemPrompt?": "string",
  "temperature?": "number",
  "maxTokens?": "number",
  "topP?": "number",
});

const CreatePresetInput = type({
  name: "string > 0",
  "providerId?": "string",
  "model?": "string",
  data: "object",
});

const UpdatePresetInput = type({
  id: "string > 0",
  "name?": "string > 0",
  "providerId?": "string | null",
  "model?": "string | null",
  "data?": "object",
});

function validateIdInput(data: unknown): { id: string } {
  const result = IdInput(data);
  if (result instanceof type.errors) throw new Error("Invalid id");
  return result;
}

function validatePresetData(data: unknown): PresetData {
  const result = PresetDataInput(data);
  if (result instanceof type.errors) throw new Error("Invalid preset data");
  return result as PresetData;
}

function validateCreateInput(data: unknown): {
  name: string;
  providerId?: string;
  model?: string;
  data: PresetData;
} {
  const result = CreatePresetInput(data);
  if (result instanceof type.errors) throw new Error("Invalid preset input");
  return { ...result, data: validatePresetData(result.data) };
}

function validateUpdateInput(
  data: unknown,
): {
  id: string;
  name?: string;
  providerId?: string | null;
  model?: string | null;
  data?: PresetData;
} {
  const result = UpdatePresetInput(data);
  if (result instanceof type.errors) throw new Error("Invalid preset update");
  if (result.data !== undefined) {
    return { ...result, data: validatePresetData(result.data) };
  }
  return result;
}

// ── Server functions ────────────────────────────────────────────────────────

export const listPresets = createServerFn({ method: "GET", strict: { output: false } }).handler(
  async (): Promise<PresetListItem[]> => {
    const { user } = await getSession();
    return repoList(user.id);
  },
);

export const getPreset = createServerFn({ method: "GET", strict: { output: false } })
  .validator(validateIdInput)
  .handler(async ({ data }): Promise<Preset> => {
    const { user } = await getSession();
    return repoGet(user.id, data.id);
  });

export const createPreset = createServerFn({ method: "POST" })
  .validator(validateCreateInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    const id = randomUUID();
    const input: CreatePresetInput = {
      id,
      userId: user.id,
      name: data.name,
      providerId: data.providerId ?? null,
      model: data.model ?? null,
      data: data.data,
    };
    repoCreate(input);
    return { id };
  });

export const updatePreset = createServerFn({ method: "POST", strict: { output: false } })
  .validator(validateUpdateInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    const patch: UpdatePresetInput = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.providerId !== undefined) patch.providerId = data.providerId;
    if (data.model !== undefined) patch.model = data.model;
    if (data.data !== undefined) patch.data = data.data;
    repoUpdate(user.id, data.id, patch);
    return { id: data.id };
  });

export const deletePreset = createServerFn({ method: "POST" })
  .validator(validateIdInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    repoDelete(user.id, data.id);
    return { id: data.id };
  });
