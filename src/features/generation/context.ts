import { db as defaultDb, type DB } from "@/db";
import { getChat, getMessages, getPathToMessage } from "@/features/chat/tree/service";
import { loadChatConfig } from "@/features/chat/config/service";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getActiveLeafId, getActivePath } from "@/lib/st-core/chat-tree/tree";
import type { ChatMessage } from "@/lib/st-core/shared/types";
import type { GenerationSnapshot } from "./contract";

export async function loadGenerationSnapshot(
  userId: string,
  chatId: string,
  placeholderLocalId: number,
  selectionIds: number[] = [],
  db: DB = defaultDb,
): Promise<GenerationSnapshot> {
  const config = await loadChatConfig(userId, chatId, "User", db);
  if (!config.provider) {
    throw new Error("No AI provider/model configured");
  }

  let path: ChatMessage[];
  if (placeholderLocalId > 0) {
    try {
      path = getPathToMessage(chatId, placeholderLocalId, db);
    } catch {
      path = getMessages(chatId, db);
    }
  } else {
    const all = getMessages(chatId, db);
    const tree = treeFromNodes(all);
    const activeLeafId = getActiveLeafId(tree);
    path = activeLeafId === null ? all : getActivePath(tree, activeLeafId);
  }

  const selection = selectionIds.length
    ? getMessages(chatId, db).filter((m) => selectionIds.includes(m.localId))
    : [];

  const chat = getChat(chatId, db);
  const character = config.character;

  return {
    chatId,
    character: {
      name: character.name,
      description: chat.characterDescription || character.description,
      personality: chat.characterPersonality || character.personality,
      scenario: chat.characterScenario || character.scenario,
      systemPrompt: chat.characterSystemPrompt || character.system_prompt || "",
      mesExample: character.mes_example || "",
      postHistoryInstructions: character.post_history_instructions || "",
      depthPrompt: (character.extensions?.depth_prompt as { prompt?: string } | undefined)?.prompt ?? "",
      tags: character.tags ?? [],
      characterBook: character.character_book,
    },
    persona: config.persona,
    path,
    loreEntries: config.loreEntries,
    preset: config.provider.preset,
    provider: config.provider,
    settings: config.settings,
    config,
    selection,
  };
}
