import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { type } from "arktype";
import { getSession } from "@/server/session";
import type { AiProvider } from "@/db/schema";
import {
  createAiProvider as repoCreate,
  deleteAiProvider as repoDelete,
  getAiProvider as repoGet,
  listAiProviders as repoList,
  updateAiProvider as repoUpdate,
  type CreateAiProviderInput,
  type UpdateAiProviderInput,
} from "@/db/repositories/aiProviders";

export type AiProviderListItem = AiProvider;

// ── Validators ──────────────────────────────────────────────────────────────

const IdInput = type({ id: "string > 0" });

const CreateProviderInput = type({
  name: "string > 0",
  baseUrl: "string > 0",
  apiKey: "string > 0",
  "defaultModel?": "string",
  "defaultHeaders?": "object",
});

const UpdateProviderInput = type({
  id: "string > 0",
  "name?": "string > 0",
  "baseUrl?": "string > 0",
  "apiKey?": "string > 0",
  "defaultModel?": "string | null",
  "defaultHeaders?": "object | null",
});

function validateIdInput(data: unknown): { id: string } {
  const result = IdInput(data);
  if (result instanceof type.errors) throw new Error("Invalid id");
  return result;
}

function validateCreateInput(data: unknown): {
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel?: string;
  defaultHeaders?: Record<string, string>;
} {
  const result = CreateProviderInput(data);
  if (result instanceof type.errors) throw new Error("Invalid provider input");
  if (result.defaultHeaders !== undefined) {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(result.defaultHeaders as Record<string, unknown>)) {
      if (typeof v !== "string") throw new Error("Header values must be strings");
      headers[k] = v;
    }
    return { ...result, defaultHeaders: headers };
  }
  return result as {
    name: string;
    baseUrl: string;
    apiKey: string;
    defaultModel?: string;
    defaultHeaders?: Record<string, string>;
  };
}

function validateUpdateInput(data: unknown): {
  id: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string | null;
  defaultHeaders?: Record<string, string> | null;
} {
  const result = UpdateProviderInput(data);
  if (result instanceof type.errors) throw new Error("Invalid provider update");
  if (result.defaultHeaders !== undefined && result.defaultHeaders !== null) {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(result.defaultHeaders as Record<string, unknown>)) {
      if (typeof v !== "string") throw new Error("Header values must be strings");
      headers[k] = v;
    }
    return { ...result, defaultHeaders: headers };
  }
  return result as {
    id: string;
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    defaultModel?: string | null;
    defaultHeaders?: Record<string, string> | null;
  };
}

// ── Server functions ────────────────────────────────────────────────────────

export const listAiProviders = createServerFn({ method: "GET" }).handler(
  async (): Promise<AiProviderListItem[]> => {
    const { user } = await getSession();
    return await repoList(user.id);
  },
);

export const getAiProvider = createServerFn({ method: "GET", strict: { output: false } })
  .validator(validateIdInput)
  .handler(async ({ data }): Promise<AiProvider> => {
    const { user } = await getSession();
    return await repoGet(user.id, data.id);
  });

export const createAiProvider = createServerFn({ method: "POST" })
  .validator(validateCreateInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    const id = randomUUID();
    const input: CreateAiProviderInput = {
      id,
      userId: user.id,
      name: data.name,
      baseUrl: data.baseUrl,
      apiKey: data.apiKey,
      defaultModel: data.defaultModel ?? null,
      defaultHeaders: (data.defaultHeaders as Record<string, string> | undefined) ?? null,
    };
    await repoCreate(input);
    return { id };
  });

export const updateAiProvider = createServerFn({ method: "POST", strict: { output: false } })
  .validator(validateUpdateInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    const patch: UpdateAiProviderInput = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.baseUrl !== undefined) patch.baseUrl = data.baseUrl;
    if (data.apiKey !== undefined) patch.apiKey = data.apiKey;
    if (data.defaultModel !== undefined) patch.defaultModel = data.defaultModel;
    if (data.defaultHeaders !== undefined) {
      patch.defaultHeaders = data.defaultHeaders as Record<string, string> | null;
    }
    await repoUpdate(user.id, data.id, patch);
    return { id: data.id };
  });

export const deleteAiProvider = createServerFn({ method: "POST" })
  .validator(validateIdInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    await repoDelete(user.id, data.id);
    return { id: data.id };
  });
