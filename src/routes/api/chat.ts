import { createFileRoute } from "@tanstack/react-router";
import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";
import { getSession } from "@/server/session";
import { getAiProvider as repoGetProvider } from "@/db/repositories/aiProviders";
import { getPreset as repoGetPreset } from "@/db/repositories/presets";
import type { PresetData } from "@/db/repositories/presets";
import { ApproxTokenCounter } from "@/lib/st-core/shared/tokens";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { user } = await getSession();
          const body = (await request.json()) as {
            messages?: Array<{ role?: string; content?: unknown }>;
            forwardedProps?: {
              providerId?: string;
              model?: string;
              presetId?: string;
              systemPrompt?: string;
            };
          };

          const forwarded = body.forwardedProps ?? {};
          if (!forwarded.providerId) {
            return new Response(JSON.stringify({ error: "No provider selected" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const provider = repoGetProvider(user.id, forwarded.providerId);

          let model = forwarded.model ?? provider.defaultModel ?? null;
          let systemPrompt = forwarded.systemPrompt ?? "";
          let temperature: number | undefined;
          let topP: number | undefined;
          let maxTokens: number | undefined;
          let contextSize: number | undefined;
          let frequencyPenalty: number | undefined;
          let presencePenalty: number | undefined;

          if (forwarded.presetId) {
            const preset = repoGetPreset(user.id, forwarded.presetId);
            if (!model && preset.model) model = preset.model;
            const data = preset.data as PresetData;
            if (data.systemPrompt) systemPrompt = data.systemPrompt;
            if (typeof data.temperature === "number") temperature = data.temperature;
            if (typeof data.topP === "number") topP = data.topP;
            if (typeof data.maxTokens === "number") maxTokens = data.maxTokens;
            if (typeof data.contextSize === "number") contextSize = data.contextSize;
            if (typeof data.frequencyPenalty === "number") frequencyPenalty = data.frequencyPenalty;
            if (typeof data.presencePenalty === "number") presencePenalty = data.presencePenalty;
          }

          if (!model) {
            return new Response(JSON.stringify({ error: "No model selected" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const adapter = openaiCompatibleText(model, {
            baseURL: provider.baseUrl,
            apiKey: provider.apiKey,
            ...(provider.defaultHeaders ? { defaultHeaders: provider.defaultHeaders } : {}),
          });

          const modelOptions: Record<string, unknown> = {};
          if (temperature !== undefined) modelOptions.temperature = temperature;
          if (topP !== undefined) modelOptions.top_p = topP;
          if (maxTokens !== undefined) modelOptions.max_tokens = maxTokens;
          if (frequencyPenalty !== undefined) modelOptions.frequency_penalty = frequencyPenalty;
          if (presencePenalty !== undefined) modelOptions.presence_penalty = presencePenalty;

          const wireMessages = Array.isArray(body.messages) ? body.messages : [];
          const userMessages = wireMessages.flatMap((m) => {
            if (m.role === "user" || m.role === "assistant") {
              if (typeof m.content === "string") {
                return [{ role: m.role as "user" | "assistant", content: m.content }];
              }
            }
            return [];
          });

          let trimmedMessages = userMessages;
          if (contextSize && contextSize > 0) {
            const counter = new ApproxTokenCounter();
            const systemTokens = systemPrompt ? counter.count(systemPrompt) : 0;
            const budget = contextSize - systemTokens;
            const kept: typeof userMessages = [];
            let used = 0;
            for (let i = userMessages.length - 1; i >= 0; i--) {
              const m = userMessages[i]!;
              const t = counter.count(m.content) + counter.count(m.role);
              if (used + t > budget) break;
              kept.unshift(m);
              used += t;
            }
            trimmedMessages = kept;
          }

          const messages = systemPrompt
            ? [{ role: "system" as const, content: systemPrompt }, ...trimmedMessages]
            : trimmedMessages;

          if (messages.length === 0) {
            return new Response(JSON.stringify({ error: "No messages to process" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const stream = chat({
            adapter,
            messages: messages as Parameters<typeof chat>[0]["messages"],
            ...(Object.keys(modelOptions).length > 0 ? { modelOptions } : {}),
          });

          return toServerSentEventsResponse(stream);
        } catch (error) {
          const message = error instanceof Error ? error.message : "An error occurred";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
