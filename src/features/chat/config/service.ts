import { db as defaultDb, type DB } from "@/db";
import { getBackground as repoGetBackground } from "@/db/repositories/backgrounds";
import { getCharacter as repoGetCharacter } from "@/db/repositories/characters";
import { getUserSettings } from "@/db/repositories/userSettings";
import { getChat } from "../tree/service";
import { resolveProvider } from "./provider";
import { resolvePersona } from "./persona";
import { getEnabledLoreEntries } from "./lorebook";
import type { ChatConfig, UserSettingsView } from "./types";
import { createLogger } from "@/features/logging";

const log = createLogger("chat:config:service");

export function hasProvider(
  settings: { defaultProviderId: string | null } | null | undefined,
): boolean {
  return !!settings?.defaultProviderId;
}

function toSettingsView(settings: ReturnType<typeof getUserSettings> | null): UserSettingsView {
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
  userId: string, // account FK
  chatId: string,
  fallbackUserName: string,
  db: DB = defaultDb,
): Promise<ChatConfig> {
  log.debug("loadChatConfig start", { chatId });

  const chat = getChat(chatId, db);
  const char = repoGetCharacter(chat.characterId, db);
  const settings = toSettingsView(getUserSettings(userId, db)); // account FK
  const provider = await resolveProvider(settings, db);

  const persona = resolvePersona(userId, fallbackUserName, db); // account FK
  const loreEntries = getEnabledLoreEntries(db);

  log.info("loadChatConfig done", {
    chatId,
    charName: char.data.name,
    hasProvider: !!settings.defaultProviderId,
    personaName: persona.name,
    loreEntryCount: loreEntries.length,
  });

  // A dangling backgroundId must degrade to "no scene", exactly like the
  // separate useBackground query did before this moved into the config.
  let backgroundPath: string | null = null;
  if (chat.backgroundId) {
    try {
      backgroundPath = repoGetBackground(chat.backgroundId, db).path;
    } catch {
      backgroundPath = null;
    }
  }

  return {
    chat,
    character: char.data,
    settings,
    provider,
    persona,
    loreEntries,
    characterImagePath: char.imagePath,
    personaId: persona.id ?? null,
    personaIconPath: persona.iconPath ?? null,
    backgroundPath,
  };
}
