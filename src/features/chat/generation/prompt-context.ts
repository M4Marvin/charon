import { db as defaultDb, type DB } from "@/db";
import type { GenerationContext, PromptContext } from "./types";
import { getMessages } from "../tree/service";
import { getPathToNode } from "../tree/active-path";
import { DEFAULT_PRESET } from "@/lib/chat/preset";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { buildChatPrompt, type BuildChatPromptResult } from "@/lib/chat/server-context";
import { loadChatConfig } from "../config/service";
import { createLogger } from "@/features/logging";

const log = createLogger("chat:gen:prompt-context");

export async function loadGenerationContext(
  userId: string,
  fallbackUserName: string,
  chatId: string,
  assistantMessageLocalId: number,
  db: DB = defaultDb,
): Promise<GenerationContext> {
  log.debug("loadGenerationContext start", { chatId, assistantMessageLocalId });

  const config = await loadChatConfig(userId, chatId, fallbackUserName, db);
  if (!config.provider) throw new Error("No provider configured");

  const { chat, character, settings, provider: resolved, persona, loreEntries } = config;

  const messages = getMessages(userId, chatId, db);
  const tree = treeFromNodes(messages);
  const path = getPathToNode(tree, assistantMessageLocalId);
  const chatHistory = path.filter((m) => {
    if (m.localId === 0) return false;
    if (m.role === "system" && m.content.length === 0) return false;
    return true;
  });

  const prompt: PromptContext = {
    character,
    chatHistory,
    preset: resolved.preset,
    defaultPreset: { ...DEFAULT_PRESET },
    userName: persona.name,
    userPersona: persona.description,
    extraLoreEntries: loreEntries.length > 0 ? loreEntries : undefined,
    userSystemPrompt: settings.systemPrompt ?? undefined,
    userPostHistoryInstructions: settings.postHistoryInstructions ?? undefined,
    characterDescription: chat.characterDescription,
    characterPersonality: chat.characterPersonality,
    characterScenario: chat.characterScenario,
    characterSystemPrompt: chat.characterSystemPrompt,
  };

  log.info("loadGenerationContext done", {
    chatHistoryLen: chatHistory.length,
    hasLore: loreEntries.length > 0,
    hasPersona: !!persona.description,
    userName: persona.name,
  });

  return { prompt, resolved };
}

export function buildPromptFromContext(ctx: PromptContext): BuildChatPromptResult {
  return buildChatPrompt({ ...ctx });
}
