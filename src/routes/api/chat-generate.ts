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
        // eslint-disable-next-line no-console
        console.log("[chat-generate] handler invoked");

        try {
          const { user } = await getSession();

          const { allowed, retryAfterMs } = checkRateLimit({ role: user.role, id: user.id });
          if (!allowed) {
            return new Response(JSON.stringify({ error: "Rate limited", retryAfterMs }), {
              status: 429,
              headers: { "Content-Type": "application/json" },
            });
          }

          const rawBody = await request.text();

          const body = JSON.parse(rawBody) as Record<string, unknown>;
          const data = (body.data ?? {}) as Record<string, unknown>;
          const chatId = (data.chatId ?? "") as string;
          const messageLocalId = data.assistantMessageLocalId as number | undefined;

          // eslint-disable-next-line no-console
          console.log("[chat-generate] request", {
            chatId,
            assistantMessageLocalId: messageLocalId,
            keys: Object.keys(body),
          });

          if (!chatId || messageLocalId == null) {
            return new Response(
              JSON.stringify({
                error: "Missing required fields",
                received: { chatId, assistantMessageLocalId: messageLocalId },
                keys: Object.keys(body),
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const ctx = await loadGenerationContext(
            user.id,
            user.name,
            chatId,
            messageLocalId,
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
          let rawBody = "";
          try {
            const clone = request.clone();
            rawBody = await clone.text();
          } catch {
            // body already consumed
          }

          // eslint-disable-next-line no-console
          console.error("[chat-generate] ERROR", {
            message: err instanceof Error ? err.message : String(err),
            name: err instanceof Error ? err.name : undefined,
            stack: err instanceof Error ? err.stack : undefined,
            rawBody: rawBody.substring(0, 500),
            cause: (err as any)?.cause,
            status: (err as any)?.status,
          });

          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
