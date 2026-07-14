import { createFileRoute } from "@tanstack/react-router";
import { chat as aiChat, toServerSentEventsResponse } from "@tanstack/ai";
import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";
import { getSession } from "@/server/session";
import { checkRateLimit } from "@/server/ratelimit";
import { getChat as repoGetChat, listMessages as repoListMessages } from "@/db/repositories/chats";
import { getCharacter as repoGetChar } from "@/db/repositories/characters";
import { getAiProviderWithGlobalFallback as repoGetProvider } from "@/db/repositories/aiProviders";
import { getPreset as repoGetPreset } from "@/db/repositories/presets";
import { listEntries as repoListEntries } from "@/db/repositories/lorebooks";
import {
  listEnabledLorebookIds,
  listUserDisabledEntryIds,
} from "@/db/repositories/userLorebookSettings";
import { getUserSettings as repoGetUserSettings } from "@/db/repositories/userSettings";
import { getPersona as repoGetPersona } from "@/db/repositories/personas";
import type { Character } from "@/db/schema";
import type { ChatMessage, ChatTree } from "@/lib/st-core/shared/types";
import type { LoreEntry as LoreEntryData } from "@/lib/st-core/lorebook";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getNode } from "@/lib/st-core/chat-tree/tree";
import { buildChatPrompt } from "@/lib/chat/server-context";
import { DEFAULT_PRESET } from "@/lib/chat/preset";
import type { ChatCompletionPreset } from "@/lib/chat/types";
import { rowToMessage } from "@/lib/chat/message-mapping";

function getPathToNode(tree: ChatTree, nodeId: number): ChatMessage[] {
  const path: ChatMessage[] = [];
  let current: ChatMessage | undefined = tree.get(nodeId);
  while (current !== undefined) {
    path.unshift(current);
    if (current.parent_id === null) break;
    current = tree.get(current.parent_id);
  }
  return path;
}

function dbPresetToPartial(
  preset: { model?: string | null; data: unknown } | null,
): Partial<ChatCompletionPreset> {
  if (!preset) return {};
  const d = preset.data as {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    contextSize?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  } | null;
  if (!d) return {};
  const partial: Partial<ChatCompletionPreset> = {};
  if (d.systemPrompt !== undefined) partial.systemPrompt = d.systemPrompt;
  if (d.temperature !== undefined) partial.temperature = d.temperature;
  if (d.maxTokens !== undefined) partial.maxResponseLength = d.maxTokens;
  if (d.topP !== undefined) partial.topP = d.topP;
  if (d.contextSize !== undefined) partial.contextSize = d.contextSize;
  if (d.frequencyPenalty !== undefined) partial.frequencyPenalty = d.frequencyPenalty;
  if (d.presencePenalty !== undefined) partial.presencePenalty = d.presencePenalty;
  return partial;
}

export const Route = createFileRoute("/api/chat-generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { user } = await getSession();

          const rateLimit = checkRateLimit(user);
          if (!rateLimit.allowed) {
            return new Response(
              JSON.stringify({
                error: "Daily request limit reached (100/day).",
                retryAfterMs: rateLimit.retryAfterMs,
              }),
              { status: 429, headers: { "Content-Type": "application/json" } },
            );
          }

          const body = (await request.json()) as {
            forwardedProps?: {
              chatId?: string;
              assistantMessageLocalId?: number;
            };
          };

          const forwarded = body.forwardedProps ?? {};
          if (!forwarded.chatId || forwarded.assistantMessageLocalId === undefined) {
            return new Response(
              JSON.stringify({ error: "chatId and assistantMessageLocalId required" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const chatRow = repoGetChat(user.id, forwarded.chatId);
          const char: Character = repoGetChar(user.id, chatRow.characterId);
          const rows = repoListMessages(user.id, forwarded.chatId);
          const tree = treeFromNodes(rows.map(rowToMessage));

          const placeholder = getNode(tree, forwarded.assistantMessageLocalId);
          const parentId = placeholder.parent_id;
          console.log("[chat-generate] req", {
            chatId: forwarded.chatId,
            assistantMessageLocalId: forwarded.assistantMessageLocalId,
            placeholderParentId: parentId,
            placeholderRole: placeholder.role,
            placeholderExtra: placeholder.extra,
            messageCountInTree: tree.size,
          });
          if (parentId === null) {
            return new Response(JSON.stringify({ error: "Placeholder has no parent" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const activePath = getPathToNode(tree, parentId);
          // Drop the hidden system root (localId 0) and any empty-content
          // message regardless of role. The root is our app's bookkeeping
          // node and must never reach the AI; the openai-base adapter rejects
          // empty-content messages (with a misleading "User message" error)
          // for all roles and would abort the stream.
          const historyMessages: import("@/lib/st-core/shared/types").ChatMessage[] = activePath
            .filter((m) => m.id !== 0)
            .filter((m) => {
              if (m.content.length === 0) {
                console.log("[chat-generate] dropping empty-content message", {
                  id: m.id,
                  role: m.role,
                  name: m.name,
                  parent_id: m.parent_id,
                  is_user: m.is_user,
                  is_system: m.is_system,
                });
                return false;
              }
              return true;
            })
            .map((m) => ({
              id: m.id,
              parent_id: m.parent_id,
              children: m.children,
              selected_child_id: m.selected_child_id,
              role: m.role,
              name: m.name,
              content: m.content,
              is_user: m.is_user,
              is_system: m.is_system,
              extra: m.extra,
            }));
          console.log("[chat-generate] history", {
            pathLen: activePath.length,
            filteredLen: historyMessages.length,
            historyRoles: historyMessages.map((m) => m.role),
            historyContentLens: historyMessages.map((m) => m.content.length),
          });

          // Load per-user settings: AI config + persona + prompt overrides.
          const userSettingsRow = repoGetUserSettings(user.id);

          const providerId = userSettingsRow?.defaultProviderId;
          if (!providerId) {
            return new Response(JSON.stringify({ error: "No AI provider configured" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          const provider = await repoGetProvider(user.id, providerId);
          const model = userSettingsRow?.defaultSelectedModel ?? provider.defaultModel;
          if (!model) {
            return new Response(JSON.stringify({ error: "No model configured" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          let dbPresetRaw: { model?: string | null; data: unknown } | null = null;
          if (userSettingsRow?.defaultPresetId) {
            try {
              dbPresetRaw = repoGetPreset(user.id, userSettingsRow.defaultPresetId);
            } catch {
              // preset missing
            }
          }

          const presetPartial = dbPresetToPartial(dbPresetRaw);
          const defaultPreset: ChatCompletionPreset = { ...DEFAULT_PRESET };

          // Load per-user enabled lorebooks + their entries, filtered to
          // skip entries the user has disabled in the overlay. The
          // context-builder also pre-filters data.disable before scanning.
          const enabledLorebookIds = listEnabledLorebookIds(user.id);
          const userDisabledEntryIds = new Set(listUserDisabledEntryIds(user.id));
          const extraLoreEntries: LoreEntryData[] = [];
          for (const lbId of enabledLorebookIds) {
            const rows = repoListEntries(user.id, lbId);
            for (const row of rows) {
              if (userDisabledEntryIds.has(row.id)) continue;
              extraLoreEntries.push(row.data);
            }
          }

          let userPersona: string | undefined;
          if (userSettingsRow?.defaultPersonaId) {
            try {
              const persona = repoGetPersona(user.id, userSettingsRow.defaultPersonaId);
              userPersona = persona.description ?? undefined;
            } catch {
              // Persona deleted out from under us — ignore, proceed without.
            }
          }

          const promptResult = buildChatPrompt({
            character: char.data,
            chatHistory: historyMessages,
            preset: presetPartial,
            defaultPreset,
            userName: user.name,
            extraLoreEntries,
            userPersona,
            userSystemPrompt: userSettingsRow?.systemPrompt ?? undefined,
            userPostHistoryInstructions: userSettingsRow?.postHistoryInstructions ?? undefined,
            chatCharacterDescription: chatRow.characterDescription,
            chatCharacterPersonality: chatRow.characterPersonality,
            chatCharacterScenario: chatRow.characterScenario,
            chatCharacterSystemPrompt: chatRow.characterSystemPrompt,
          });

          const adapter = openaiCompatibleText(model, {
            baseURL: provider.baseUrl,
            apiKey: provider.apiKey,
            ...(provider.defaultHeaders ? { defaultHeaders: provider.defaultHeaders } : {}),
          });

          // Greeting regeneration (placeholder.parent_id === 0) builds a prompt
          // from the root only — no user message in history. OpenAI-compatible
          // APIs reject user-less prompts with 400, so inject a non-whitespace
          // sentinel user message when the prompt has no user turn. The model
          // treats it as a no-op signal and produces the greeting/continuation.
          // We deliberately use a non-whitespace string (".") because some
          // OpenAI-compatible proxies trim/blank user content and reject it as
          // "empty user message".
          const hasUserMessage = promptResult.messages.some((m) => m.role === "user");
          const finalMessages = hasUserMessage
            ? promptResult.messages
            : [...promptResult.messages, { role: "user" as const, content: "." }];

          console.log("[chat-generate] prompt", {
            msgCount: promptResult.messages.length,
            hasUserMessage,
            sentinelInjected: !hasUserMessage,
            finalMsgCount: finalMessages.length,
            model,
            providerId,
          });

          const stream = aiChat({
            adapter,
            messages: finalMessages as Parameters<typeof aiChat>[0]["messages"],
            ...(Object.keys(promptResult.modelOptions).length > 0
              ? { modelOptions: promptResult.modelOptions }
              : {}),
          });

          return toServerSentEventsResponse(stream);
        } catch (error) {
          console.error("[chat-generate] ERROR", {
            message: error instanceof Error ? error.message : String(error),
            name: error instanceof Error ? error.name : undefined,
            stack: error instanceof Error ? error.stack : undefined,
            // Adapter errors often carry provider response data on .status / .response / .body
            status: (error as { status?: unknown })?.status,
            response: (error as { response?: unknown })?.response,
            body: (error as { body?: unknown })?.body,
            cause: (error as { cause?: unknown })?.cause,
          });
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
