import type { UpdateChatSettings, UpdateUserSettings } from "@/server/schemas/chat";
import type { UserSettingsPatch } from "@/db/repositories/userSettings";

export type ChatSettingsPatch = Partial<{
  title: string;
  characterDescription: string;
  characterPersonality: string;
  characterScenario: string;
  characterSystemPrompt: string;
  backgroundId: string | null;
}>;

type ChatSettingsInput = (typeof UpdateChatSettings)["Type"];
type UserSettingsInput = (typeof UpdateUserSettings)["Type"];

/**
 * Map a decoded (partial) chat settings payload onto a repository patch.
 * Absent keys stay absent; `null` clears the text columns, matching the
 * existing title/text conventions in the chats repo.
 */
export function toChatSettingsPatch(data: ChatSettingsInput): ChatSettingsPatch {
  const patch: ChatSettingsPatch = {};
  if (data.title !== undefined) patch.title = data.title ?? "";
  if (data.characterDescription !== undefined)
    patch.characterDescription = data.characterDescription ?? "";
  if (data.characterPersonality !== undefined)
    patch.characterPersonality = data.characterPersonality ?? "";
  if (data.characterScenario !== undefined) patch.characterScenario = data.characterScenario ?? "";
  if (data.characterSystemPrompt !== undefined)
    patch.characterSystemPrompt = data.characterSystemPrompt ?? "";
  if (data.backgroundId !== undefined) patch.backgroundId = data.backgroundId;
  return patch;
}

export function toUserSettingsPatch(data: UserSettingsInput): UserSettingsPatch {
  const patch: UserSettingsPatch = {};
  if (data.defaultProviderId !== undefined) patch.defaultProviderId = data.defaultProviderId;
  if (data.defaultPresetId !== undefined) patch.defaultPresetId = data.defaultPresetId;
  if (data.defaultSelectedModel !== undefined)
    patch.defaultSelectedModel = data.defaultSelectedModel;
  if (data.defaultPersonaId !== undefined) patch.defaultPersonaId = data.defaultPersonaId;
  if (data.systemPrompt !== undefined) patch.systemPrompt = data.systemPrompt;
  if (data.postHistoryInstructions !== undefined)
    patch.postHistoryInstructions = data.postHistoryInstructions;
  if (data.impersonationPrompt !== undefined) patch.impersonationPrompt = data.impersonationPrompt;
  return patch;
}
