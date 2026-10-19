import { db as defaultDb, type DB } from "@/db";
import { getMessages, getPathToMessage } from "@/features/chat/tree/service";
import { loadChatConfig } from "@/features/chat/config/service";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getActiveLeafId, getActivePath } from "@/lib/st-core/chat-tree/tree";
import { convertBookEntries } from "@/lib/chat/lorebook";
import type { CharacterDataV2 } from "@/lib/st-core/character/types";
import type { ChatMessage } from "@/lib/st-core/shared/types";
import type { LoreEntry } from "@/lib/st-core/lorebook/types";
import type { GenerationSnapshot } from "./contract";

/** Merge the card's embedded book with the standalone lorebooks, keeping uids unique. */
export function mergeLoreEntries(standalone: LoreEntry[], character: CharacterDataV2): LoreEntry[] {
  const book = character.character_book;
  if (!book?.entries?.length) return standalone;
  const nextUid = standalone.reduce((max, entry) => Math.max(max, entry.uid), 0);
  return [
    ...standalone,
    ...convertBookEntries(book.entries)
      .filter((entry) => !entry.disable && entry.content.trim().length > 0)
      .map((entry, index) => ({ ...entry, uid: nextUid + index + 1 })),
  ];
}

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

  const chat = config.chat;
  const character = config.character;
  const depthPrompt = character.extensions?.depth_prompt;

  return {
    character: {
      name: character.name,
      description: chat.characterDescription || character.description,
      personality: chat.characterPersonality || character.personality,
      scenario: chat.characterScenario || character.scenario,
      systemPrompt: chat.characterSystemPrompt || character.system_prompt || "",
      mesExample: character.mes_example || "",
      postHistoryInstructions: character.post_history_instructions || "",
      depthPrompt: depthPrompt?.prompt ?? "",
      depthPromptDepth: depthPrompt?.depth ?? 4,
      depthPromptRole: depthPrompt?.role ?? "system",
      creatorNotes: character.creator_notes || "",
      tags: character.tags ?? [],
    },
    persona: config.persona,
    path,
    loreEntries: mergeLoreEntries(config.loreEntries, character),
    preset: config.provider.preset,
    provider: config.provider,
    settings: config.settings,
    selection,
  };
}
