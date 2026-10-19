import { useChatConfig } from "@/hooks/useChatConfig";
import { useUpdateChatOverrides } from "@/hooks/useChatConfig";
import { BlurCommitTextarea } from "../blur-commit-textarea";
import { SectionHeader } from "../section-header";
import { getSaveState, useSettingsSaveStatus } from "../save-status";

interface SectionProps {
  chatId: string;
}

export function CharacterSection({ chatId }: SectionProps) {
  const { data: config } = useChatConfig(chatId);
  const updateOverrides = useUpdateChatOverrides();
  const saveState = getSaveState(updateOverrides);
  const retrySave = updateOverrides.variables
    ? () => updateOverrides.mutate(updateOverrides.variables!)
    : undefined;

  useSettingsSaveStatus("character", saveState, {
    retry: retrySave,
    at: updateOverrides.submittedAt,
    error: updateOverrides.error,
  });

  const chat = config?.chat;
  const card = config?.character;
  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Character"
        description="Overrides for this chat. Empty fields use the character card."
      />

      <BlurCommitTextarea
        id="cs-desc"
        label="Description"
        placeholder="Leave empty to use the character card"
        defaultValue={chat?.characterDescription ?? ""}
        inheritedValue={card ? card.description : undefined}
        onUseCard={() => updateOverrides.mutate({ id: chatId, characterDescription: null })}
        onCommit={(v) => updateOverrides.mutate({ id: chatId, characterDescription: v || null })}
      />
      <BlurCommitTextarea
        id="cs-personality"
        label="Personality"
        placeholder="Leave empty to use the character card"
        defaultValue={chat?.characterPersonality ?? ""}
        inheritedValue={card ? card.personality : undefined}
        onUseCard={() => updateOverrides.mutate({ id: chatId, characterPersonality: null })}
        onCommit={(v) => updateOverrides.mutate({ id: chatId, characterPersonality: v || null })}
      />
      <BlurCommitTextarea
        id="cs-scenario"
        label="Scenario"
        placeholder="Leave empty to use the character card"
        defaultValue={chat?.characterScenario ?? ""}
        inheritedValue={card ? card.scenario : undefined}
        onUseCard={() => updateOverrides.mutate({ id: chatId, characterScenario: null })}
        onCommit={(v) => updateOverrides.mutate({ id: chatId, characterScenario: v || null })}
      />
      <BlurCommitTextarea
        id="cs-sys-prompt"
        label="Chat system prompt"
        placeholder="Leave empty to use the character card"
        defaultValue={chat?.characterSystemPrompt ?? ""}
        inheritedValue={card ? card.system_prompt : undefined}
        onUseCard={() => updateOverrides.mutate({ id: chatId, characterSystemPrompt: null })}
        onCommit={(v) => updateOverrides.mutate({ id: chatId, characterSystemPrompt: v || null })}
      />
    </div>
  );
}
