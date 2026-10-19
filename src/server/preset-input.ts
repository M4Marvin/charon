import { type } from "arktype";
import type { PresetData } from "@/db/repositories/presets";

/**
 * Preset input validation, kept free of session/db imports so it can be tested
 * directly. Optional provider/model fields are normalised here because the
 * transport can deliver `undefined` keys that arktype optional properties
 * reject; empty strings mean "no provider/model".
 */

const PresetDataInput = type({
  "systemPrompt?": "string",
  "temperature?": "number",
  "maxTokens?": "number",
  "topP?": "number",
  "contextSize?": "number",
  "frequencyPenalty?": "number",
  "presencePenalty?": "number",
});

const CreatePresetInput = type({
  name: "string > 0",
  "providerId?": "string | null",
  "model?": "string | null",
  data: "object",
});

const UpdatePresetInput = type({
  id: "string > 0",
  "name?": "string > 0",
  "providerId?": "string | null",
  "model?": "string | null",
  "data?": "object",
});

export interface CreatePresetValidation {
  name: string;
  providerId: string | null;
  model: string | null;
  data: PresetData;
}

export interface UpdatePresetValidation {
  id: string;
  name?: string;
  providerId?: string | null;
  model?: string | null;
  data?: PresetData;
}

function pruneUndefined(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function validatePresetData(data: unknown): PresetData {
  const result = PresetDataInput(pruneUndefined(data));
  if (result instanceof type.errors) throw new Error("Invalid preset data");
  return result as PresetData;
}

export function validateCreatePresetInput(data: unknown): CreatePresetValidation {
  const result = CreatePresetInput(pruneUndefined(data));
  if (result instanceof type.errors) throw new Error("Invalid preset input");
  const name = result.name.trim();
  if (!name) throw new Error("Invalid preset input");
  return {
    name,
    providerId: normalizeOptionalId(result.providerId),
    model: normalizeOptionalId(result.model),
    data: validatePresetData(result.data),
  };
}

export function validateUpdatePresetInput(data: unknown): UpdatePresetValidation {
  const result = UpdatePresetInput(pruneUndefined(data));
  if (result instanceof type.errors) throw new Error("Invalid preset update");
  const patch: UpdatePresetValidation = { id: result.id };
  if (result.name !== undefined) {
    const name = result.name.trim();
    if (!name) throw new Error("Invalid preset update");
    patch.name = name;
  }
  if (result.providerId !== undefined) patch.providerId = normalizeOptionalId(result.providerId);
  if (result.model !== undefined) patch.model = normalizeOptionalId(result.model);
  if (result.data !== undefined) patch.data = validatePresetData(result.data);
  return patch;
}
