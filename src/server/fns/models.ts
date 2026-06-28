import { createServerFn } from "@tanstack/react-start";
import { type } from "arktype";
import { getSession } from "@/server/session";
import { getAiProvider as repoGet } from "@/db/repositories/aiProviders";

export type ProviderModel = { id: string };

export type ProbeResult = {
  ok: boolean;
  latencyMs: number;
  modelCount: number;
  error?: string;
  models: ProviderModel[];
};

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

async function probeProviderModels(provider: {
  baseUrl: string;
  apiKey: string;
  defaultHeaders?: Record<string, string> | null;
}): Promise<ProbeResult> {
  const headers: Record<string, string> = {
    ...provider.defaultHeaders,
    Authorization: `Bearer ${provider.apiKey}`,
  };

  const url = `${normalizeBaseUrl(provider.baseUrl)}/models`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  const start = performance.now();

  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const latencyMs = Math.round(performance.now() - start);

    if (!res.ok) {
      return {
        ok: false,
        latencyMs,
        modelCount: 0,
        error: `Provider returned HTTP ${res.status} ${res.statusText}`.trim(),
        models: [],
      };
    }

    const payload = (await res.json()) as unknown;
    const ids = extractModelIds(payload);
    return {
      ok: true,
      latencyMs,
      modelCount: ids.length,
      models: ids.map((id) => ({ id })),
    };
  } catch (e) {
    const latencyMs = Math.round(performance.now() - start);
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, latencyMs, modelCount: 0, error: "Request timed out (8s)", models: [] };
    }
    return {
      ok: false,
      latencyMs,
      modelCount: 0,
      error: e instanceof Error ? e.message : String(e),
      models: [],
    };
  } finally {
    clearTimeout(timer);
  }
}

export const listProviderModels = createServerFn({ method: "GET", strict: { output: false } })
  .validator(validateIdInput)
  .handler(async ({ data }): Promise<ProviderModel[]> => {
    const { user } = await getSession();
    const provider = repoGet(user.id, data.id);

    const PROBE = await probeProviderModels(provider);
    if (PROBE.ok) return PROBE.models;

    await new Promise((r) => setTimeout(r, 300));
    const retry = await probeProviderModels(provider);
    if (retry.ok) return retry.models;

    throw new Error(retry.error ?? "Provider unreachable");
  });

export const testProviderConnection = createServerFn({ method: "GET" })
  .validator(validateIdInput)
  .handler(async ({ data }): Promise<ProbeResult> => {
    const { user } = await getSession();
    const provider = repoGet(user.id, data.id);
    return probeProviderModels(provider);
  });
