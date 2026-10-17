import type { CharacterDataV2 } from "@/lib/st-core/character/types";
import type { LoreEntry } from "@/lib/st-core/lorebook/types";
import type { ChatCompletionPreset } from "@/lib/chat/types";
import type { ResolvedProvider } from "../generation/types";

export type { ResolvedProvider };
import type { ChatDetail } from "../tree/types";

export interface UserSettingsView {
  defaultProviderId: string | null;
  defaultPresetId: string | null;
  defaultSelectedModel: string | null;
  defaultPersonaId: string | null;
  systemPrompt: string | null;
  postHistoryInstructions: string | null;
  impersonationPrompt: string | null;
  imagePromptExample: string | null;
}

export interface PersonaInfo {
  name: string;
  description?: string;
  /** Set only when a stored persona was resolved (not the account-name fallback). */
  id?: string;
  iconPath?: string | null;
}

export interface ChatConfig {
  chat: ChatDetail;
  character: CharacterDataV2;
  settings: UserSettingsView;
  provider: ResolvedProvider | null;
  persona: PersonaInfo;
  loreEntries: LoreEntry[];
  characterImagePath: string | null;
  personaId: string | null;
  personaIconPath: string | null;
  backgroundPath: string | null;
}

export interface ChatConfigClient {
  chat: ChatDetail;
  character: CharacterDataV2;
  settings: UserSettingsView;
  provider: { model: string; preset: Partial<ChatCompletionPreset> } | null;
  persona: PersonaInfo;
  loreEntries: LoreEntry[];
  characterImagePath: string | null;
  personaId: string | null;
  personaIconPath: string | null;
  backgroundPath: string | null;
}

export function toClientConfig(config: ChatConfig): ChatConfigClient {
  return {
    chat: config.chat,
    character: config.character,
    settings: config.settings,
    provider: config.provider
      ? { model: config.provider.model, preset: config.provider.preset }
      : null,
    persona: config.persona,
    loreEntries: config.loreEntries,
    characterImagePath: config.characterImagePath,
    personaId: config.personaId,
    personaIconPath: config.personaIconPath,
    backgroundPath: config.backgroundPath,
  };
}
