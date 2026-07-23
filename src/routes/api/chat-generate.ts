import { createFileRoute } from "@tanstack/react-router";
import { chat as aiChat, toServerSentEventsResponse } from "@tanstack/ai";
import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";
import { getSession } from "@/server/session";
import { checkRateLimit } from "@/server/ratelimit";
import {
  loadGenerationContext,
  buildPromptFromContext,
} from "@/features/chat/generation/prompt-context";

export const Route = createFileRoute("/api/chat-generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { user } = await getSession();

          const { allowed, retryAfterMs } = checkRateLimit({ role: user.role, id: user.id });
          if (!allowed) {
            return new Response(JSON.stringify({ error: "Rate limited", retryAfterMs }), {
              status: 429,
              headers: { "Content-Type": "application/json" },
            });
          }

          const body = (await request.json()) as { chatId?: string; assistantMessageLocalId?: number };
          if (!body.chatId || body.assistantMessageLocalId == null) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const ctx = await loadGenerationContext(
            user.id,
            user.name,
            body.chatId,
            body.assistantMessageLocalId,
          );

          const promptResult = buildPromptFromContext(ctx.prompt);

          let finalMessages = promptResult.messages;
          if (!finalMessages.some((m) => m.role === "user" && m.content.length > 0)) {
            finalMessages = [...finalMessages, { role: "user" as const, content: "." }];
          }

          const adapter = openaiCompatibleText(ctx.resolved.model, {
            baseURL: ctx.resolved.provider.baseUrl,
            apiKey: ctx.resolved.provider.apiKey,
            ...(ctx.resolved.provider.defaultHeaders
              ? { defaultHeaders: ctx.resolved.provider.defaultHeaders }
              : {}),
          });

          const stream = aiChat({
            adapter,
            messages: finalMessages as Parameters<typeof aiChat>[0]["messages"],
            ...(Object.keys(promptResult.modelOptions).length > 0
              ? { modelOptions: promptResult.modelOptions }
              : {}),
          });

          return toServerSentEventsResponse(stream);
        } catch (err) {
          console.error("[chat-generate]", err);
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
