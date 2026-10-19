import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";
import type { AnyTextAdapter } from "@tanstack/ai";
import type { ResolvedProvider } from "@/features/chat/config/types";
import type { ChatCompletionPreset } from "@/lib/chat/types";

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("Provider base URL must start with http:// or https://");
  }
  return trimmed;
}

export function makeAdapter(resolved: ResolvedProvider): AnyTextAdapter {
  return openaiCompatibleText(resolved.model, {
    name: "charon",
    baseURL: normalizeBaseUrl(resolved.provider.baseUrl),
    apiKey: resolved.provider.apiKey,
    ...(resolved.provider.defaultHeaders
      ? { defaultHeaders: resolved.provider.defaultHeaders }
      : {}),
    maxRetries: 2,
    timeout: 60_000,
    api: "chat-completions",
  });
}

export function modelOptionsFor(
  preset: Partial<ChatCompletionPreset>,
  mode: "chat" | "impersonate" | "image" | "rewrite" | "transform",
): Record<string, unknown> {
  const outputReserve =
    mode === "image"
      ? 600
      : mode === "rewrite" || mode === "transform"
        ? 1200
        : mode === "impersonate"
          ? 500
          : (preset.maxResponseLength ?? 1200);

  const temperature =
    mode === "image"
      ? 0.2
      : mode === "rewrite" || mode === "transform"
        ? Math.min(preset.temperature ?? 0.8, 0.8)
        : (preset.temperature ?? 0.8);

  return {
    temperature,
    top_p: preset.topP ?? 1,
    max_tokens: Math.max(64, Math.min(outputReserve, 8192)),
    ...(preset.frequencyPenalty ? { frequency_penalty: preset.frequencyPenalty } : {}),
    ...(preset.presencePenalty ? { presence_penalty: preset.presencePenalty } : {}),
    ...(typeof preset.seed === "number" && preset.seed >= 0 ? { seed: preset.seed } : {}),
  };
}
