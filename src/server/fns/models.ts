import { createServerFn } from "@tanstack/react-start";
import { type } from "arktype";
import { getSession } from "@/server/session";
import { getAiProvider as repoGet } from "@/db/repositories/aiProviders";

export type ProviderModel = { id: string };

const IdInput = type({ id: "string > 0" });

function validateIdInput(data: unknown): { id: string } {
  const result = IdInput(data);
  if (result instanceof type.errors) throw new Error("Invalid id");
  return result;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function extractModelIds(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  if (Array.isArray(p.data)) {
    return p.data
      .map((m) => (m && typeof m === "object" && "id" in m ? (m as { id: unknown }).id : null))
      .filter((id): id is string => typeof id === "string");
  }
  if (Array.isArray(p.models)) {
    return p.models
      .map((m) => (typeof m === "string" ? m : null))
      .filter((id): id is string => typeof id === "string");
  }
  return [];
}

export const listProviderModels = createServerFn({ method: "GET", strict: { output: false } })
  .validator(validateIdInput)
  .handler(async ({ data }): Promise<ProviderModel[]> => {
    const { user } = await getSession();
    const provider = repoGet(user.id, data.id);
    const url = `${normalizeBaseUrl(provider.baseUrl)}/models`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${provider.apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Provider returned ${res.status}`);
    }
    const payload = (await res.json()) as unknown;
    const ids = extractModelIds(payload);
    return ids.map((id) => ({ id }));
  });
