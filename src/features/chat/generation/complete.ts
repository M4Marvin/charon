import type { ResolvedProvider } from "./types";
import { createLogger } from "@/features/logging";

const log = createLogger("chat:gen:complete");

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Non-streaming chat completion against the resolved provider, shared by
 * impersonation and image-prompt generation.
 */
export async function completeChat(
  resolved: ResolvedProvider,
  messages: ChatCompletionMessage[],
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${resolved.provider.apiKey}`,
  };
  if (resolved.provider.defaultHeaders) {
    for (const [k, v] of Object.entries(resolved.provider.defaultHeaders)) {
      if (v) headers[k] = v;
    }
  }

  const response = await fetchFn(`${resolved.provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: resolved.model, messages, stream: false }),
  });

  if (!response.ok) {
    const body = await response.text();
    log.error("provider error", { status: response.status, body: body.substring(0, 500) });
    throw new Error(`Provider returned ${response.status}: ${body}`);
  }

  const json = (await response.json()) as {
    choices: Array<{ message: { content: string | null } }>;
  };
  return json.choices[0]?.message?.content ?? "";
}
