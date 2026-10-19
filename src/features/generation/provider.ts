import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";
import type { AnyTextAdapter } from "@tanstack/ai";
import type { ResolvedProvider } from "@/features/chat/config/types";

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
