import { db as defaultDb, type DB } from "@/db";
import type { GenerationContext, PromptContext } from "./types";
import type { LoreEntry } from "@/lib/st-core/lorebook/types";
import { getChat as repoGetChat } from "@/db/repositories/chats";
import { getCharacter as repoGetCharacter } from "@/db/repositories/characters";
import { getUserSettings } from "@/db/repositories/userSettings";
import { getPersona } from "@/db/repositories/personas";
import {
  listEnabledLorebookIds,
  listUserDisabledEntryIds,
} from "@/db/repositories/userLorebookSettings";
import { listEntries as repoListEntries } from "@/db/repositories/lorebooks";
import { getMessages } from "../tree/service";
import { getPathToNode } from "../tree/active-path";
import { DEFAULT_PRESET } from "@/lib/chat/preset";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { buildChatPrompt, type BuildChatPromptResult } from "@/lib/chat/server-context";
import { resolveProvider } from "./provider";
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

  const chat = repoGetChat(userId, chatId, db);
  const char = repoGetCharacter(userId, chat.characterId, db);

  const messages = getMessages(userId, chatId, db);
  const tree = treeFromNodes(messages);
  const path = getPathToNode(tree, assistantMessageLocalId);
  const chatHistory = path.filter((m) => {
    if (m.localId === 0) return false;
    if (m.role === "system" && m.content.length === 0) return false;
    return true;
  });

  const settings = getUserSettings(userId, db);
  const resolved = await resolveProvider(userId, db);
  log.debug("loadGenerationContext: provider resolved", { model: resolved.model });

  let extraLoreEntries: LoreEntry[] | undefined;
  try {
    const enabledIds = listEnabledLorebookIds(userId, db);
    if (enabledIds.length > 0) {
      const disabled = new Set(listUserDisabledEntryIds(userId, db));
      const entries: LoreEntry[] = [];
      for (const lbId of enabledIds) {
        const lbEntries = repoListEntries(userId, lbId, db);
        for (const e of lbEntries) {
          if (disabled.has(e.id)) continue;
          if (e.data.disable ?? false) continue;
          entries.push(e.data);
        }
      }
      if (entries.length > 0) extraLoreEntries = entries;
    }
  } catch {
    // lorebooks missing — ignore
  }

  let userPersona: string | undefined;
  let userName = fallbackUserName;
  if (settings?.defaultPersonaId) {
    try {
      const persona = getPersona(userId, settings.defaultPersonaId, db);
      userPersona = persona.description ?? undefined;
      userName = persona.name;
    } catch {
      // persona deleted — keep fallbackUserName
    }
  }

  const prompt: PromptContext = {
    character: char.data,
    chatHistory,
    preset: resolved.preset,
    defaultPreset: { ...DEFAULT_PRESET },
    userName,
    userPersona,
    extraLoreEntries,
    userSystemPrompt: settings?.systemPrompt ?? undefined,
    userPostHistoryInstructions: settings?.postHistoryInstructions ?? undefined,
    characterDescription: chat.characterDescription,
    characterPersonality: chat.characterPersonality,
    characterScenario: chat.characterScenario,
    characterSystemPrompt: chat.characterSystemPrompt,
  };

  log.info("loadGenerationContext done", {
    chatHistoryLen: chatHistory.length,
    hasLore: !!extraLoreEntries,
    hasPersona: !!userPersona,
    userName,
  });

  return { prompt, resolved };
}

export function buildPromptFromContext(ctx: PromptContext): BuildChatPromptResult {
  return buildChatPrompt({ ...ctx });
}
