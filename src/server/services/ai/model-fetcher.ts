import { Effect } from "effect";
import type { AiProvider } from "@/db/schema";

export type ProviderModel = { id: string };

export type ProbeResult = {
  ok: boolean;
  latencyMs: number;
  modelCount: number;
  error?: string;
  models: ProviderModel[];
};

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
    return p.models.filter((m): m is string => typeof m === "string");
  }
  return [];
}

export const probeProviderModels = (
  provider: Pick<AiProvider, "baseUrl" | "apiKey" | "defaultHeaders">,
): Effect.Effect<ProbeResult> =>
  Effect.gen(function* () {
    const start = performance.now();
    const url = `${normalizeBaseUrl(provider.baseUrl)}/models`;

    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(url, {
          headers: {
            ...provider.defaultHeaders,
            Authorization: `Bearer ${provider.apiKey}`,
          },
          signal: AbortSignal.timeout(8000),
        }),
      catch: (e) => e,
    });

    const latencyMs = Math.round(performance.now() - start);

    if (!response.ok) {
      return {
        ok: false,
        latencyMs,
        modelCount: 0,
        error: `HTTP ${response.status} ${response.statusText}`.trim(),
        models: [],
      };
    }

    const payload = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (e) => e,
    });

    const ids = extractModelIds(payload);

    return {
      ok: true,
      latencyMs,
      modelCount: ids.length,
      models: ids.map((id) => ({ id })),
    };
  }).pipe(
    Effect.catchAll((error) =>
      Effect.succeed({
        ok: false,
        latencyMs: 0,
        modelCount: 0,
        error: error instanceof Error ? error.message : String(error),
        models: [],
      }),
    ),
  );
