import { Effect } from "effect";
import type { AiProvider } from "@/db/schema";

export type ChatTestResult = {
  ok: boolean;
  latencyMs: number;
  reply?: string;
  error?: string;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function extractReply(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const p = payload as Record<string, unknown>;
  const choices = Array.isArray(p.choices) ? p.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const msg = first?.message as Record<string, unknown> | undefined;
  if (msg && typeof msg.content === "string" && msg.content.length > 0) return msg.content;
  return undefined;
}

function extractErrorDetail(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const err = parsed.error as Record<string, unknown> | undefined;
    const detail = typeof err?.message === "string" ? err.message : parsed.message;
    if (typeof detail === "string" && detail.length > 0) return detail;
  } catch {
    // not JSON — fall through to raw text
  }
  return trimmed.slice(0, 200);
}

/**
 * Sends a single short chat completion to an OpenAI-compatible provider
 * and extracts the reply. Used by the settings "test message" action.
 */
export const testProviderChatCompletion = (
  provider: Pick<AiProvider, "baseUrl" | "apiKey" | "defaultHeaders">,
  model: string,
  message: string,
): Effect.Effect<ChatTestResult> =>
  Effect.gen(function* () {
    const start = performance.now();
    const url = `${normalizeBaseUrl(provider.baseUrl)}/chat/completions`;

    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...provider.defaultHeaders,
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: message }],
            max_tokens: 32,
            stream: false,
          }),
          signal: AbortSignal.timeout(15000),
        }),
      catch: (e) => e,
    });

    const latencyMs = Math.round(performance.now() - start);

    if (!response.ok) {
      const errorBody = yield* Effect.tryPromise({
        try: () => response.text().catch(() => ""),
        catch: () => "",
      });
      const detail = extractErrorDetail(errorBody);
      return {
        ok: false,
        latencyMs,
        error: detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status} ${response.statusText}`.trim(),
      };
    }

    const payload = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (e) => e,
    });

    const reply = extractReply(payload);
    if (reply === undefined) {
      return { ok: false, latencyMs, error: "No reply content in response" };
    }

    return { ok: true, latencyMs, reply };
  }).pipe(
    Effect.catchAll((error) =>
      Effect.succeed({
        ok: false,
        latencyMs: 0,
        error: error instanceof Error ? error.message : String(error),
      }),
    ),
  );
