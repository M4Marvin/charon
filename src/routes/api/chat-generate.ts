import { createFileRoute } from "@tanstack/react-router";
import { chat as aiChat, toServerSentEventsResponse } from "@tanstack/ai";
import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";
import { getSession } from "@/server/session";
import { getChat as repoGetChat, listMessages as repoListMessages } from "@/db/repositories/chats";
import { getCharacter as repoGetChar } from "@/db/repositories/characters";
import { getAiProvider as repoGetProvider } from "@/db/repositories/aiProviders";
import { getPreset as repoGetPreset } from "@/db/repositories/presets";
import type { ChatMessageRow, Character } from "@/db/schema";
import type { ChatMessage, ChatTree } from "@/lib/st-core/shared/types";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getNode } from "@/lib/st-core/chat-tree/tree";
import { buildChatPrompt } from "@/lib/chat/server-context";
import { DEFAULT_PRESET } from "@/lib/chat/preset";
import type { ChatCompletionPreset } from "@/lib/chat/types";

function rowToMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.localId,
    parent_id: row.parentLocalId,
    children: row.children ?? [],
    selected_child_id: row.selectedChildLocalId,
    role: row.role,
    name: row.name ?? undefined,
    content: row.content,
    is_user: row.isUser ?? undefined,
    is_system: row.isSystem ?? undefined,
    extra: row.extra ?? undefined,
  };
}

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
          if (parentId === null) {
            return new Response(JSON.stringify({ error: "Placeholder has no parent" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const activePath = getPathToNode(tree, parentId);
          const historyMessages: import("@/lib/st-core/shared/types").ChatMessage[] = activePath.map(
            (m) => ({
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
            }),
          );

          const providerId = chatRow.providerId;
          if (!providerId) {
            return new Response(
              JSON.stringify({ error: "No provider configured for this chat" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }
          const provider = repoGetProvider(user.id, providerId);
          const model = chatRow.selectedModel ?? provider.defaultModel;
          if (!model) {
            return new Response(
              JSON.stringify({ error: "No model configured for this chat" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          let dbPresetRaw: { model?: string | null; data: unknown } | null = null;
          if (chatRow.presetId) {
            try {
              dbPresetRaw = repoGetPreset(user.id, chatRow.presetId);
            } catch {
              // preset missing
            }
          }

          const presetPartial = dbPresetToPartial(dbPresetRaw);
          const defaultPreset: ChatCompletionPreset = { ...DEFAULT_PRESET };

          const promptResult = buildChatPrompt({
            character: char.data,
            chatHistory: historyMessages,
            preset: presetPartial,
            defaultPreset,
            userName: user.name,
          });

          const adapter = openaiCompatibleText(model, {
            baseURL: provider.baseUrl,
            apiKey: provider.apiKey,
            ...(provider.defaultHeaders ? { defaultHeaders: provider.defaultHeaders } : {}),
          });

          const stream = aiChat({
            adapter,
            messages: promptResult.messages as Parameters<typeof aiChat>[0]["messages"],
            ...(Object.keys(promptResult.modelOptions).length > 0
              ? { modelOptions: promptResult.modelOptions }
              : {}),
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
