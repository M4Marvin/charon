import { db as defaultDb, type DB } from "@/db";
import { getCharacter as repoGetCharacter } from "@/db/repositories/characters";
import { getUserSettings } from "@/db/repositories/userSettings";
import { getChat } from "../tree/service";
import { resolveProvider } from "./provider";
import { resolvePersona } from "./persona";
import { getEnabledLoreEntries } from "./lorebook";
import type { ChatConfig, UserSettingsView } from "./types";
import { createLogger } from "@/features/logging";

const log = createLogger("chat:config:service");

export function hasProvider(userId: string, db: DB = defaultDb): boolean {
  const settings = getUserSettings(userId, db);
  return !!settings?.defaultProviderId;
}

function toSettingsView(
  settings: ReturnType<typeof getUserSettings> | null,
): UserSettingsView {
  return {
    defaultProviderId: settings?.defaultProviderId ?? null,
    defaultPresetId: settings?.defaultPresetId ?? null,
    defaultSelectedModel: settings?.defaultSelectedModel ?? null,
    defaultPersonaId: settings?.defaultPersonaId ?? null,
    systemPrompt: settings?.systemPrompt ?? null,
    postHistoryInstructions: settings?.postHistoryInstructions ?? null,
    impersonationPrompt: settings?.impersonationPrompt ?? null,
  };
}

export async function loadChatConfig(
  userId: string,
  chatId: string,
  fallbackUserName: string,
  db: DB = defaultDb,
): Promise<ChatConfig> {
  log.debug("loadChatConfig start", { chatId });

  const chat = getChat(userId, chatId, db);
  const char = repoGetCharacter(userId, chat.characterId, db);
  const settings = toSettingsView(getUserSettings(userId, db));
  const provider = await resolveProvider(userId, db);
  const persona = resolvePersona(userId, fallbackUserName, db);
  const loreEntries = getEnabledLoreEntries(userId, db);

  log.info("loadChatConfig done", {
    chatId,
    charName: char.data.name,
    hasProvider: !!settings.defaultProviderId,
    personaName: persona.name,
    loreEntryCount: loreEntries.length,
  });

  return { chat, character: char.data, settings, provider, persona, loreEntries };
}
