import { useChatConfig } from "@/hooks/useChatConfig";
import { useUpdateChatOverrides } from "@/hooks/useChatConfig";
import { BlurCommitTextarea } from "../blur-commit-textarea";
import { SectionHeader } from "../section-header";
import { SaveStatus, getSaveState } from "../save-status";

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

  const chat = config?.chat;
  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Character"
        description="Overrides for this chat. Empty fields use the character card."
        scope="chat"
      />
      <SaveStatus state={saveState} error={updateOverrides.error} onRetry={retrySave} />

      <BlurCommitTextarea
        id="cs-desc"
        label="Description"
        placeholder="Leave empty to use the character card"
        defaultValue={chat?.characterDescription ?? ""}
        original={config?.character.description ?? null}
        status={saveState}
        error={updateOverrides.error}
        onRetry={retrySave}
        onRevert={() => updateOverrides.reset()}
        onReset={() => updateOverrides.mutate({ id: chatId, characterDescription: null })}
        resetLabel="Reset to card"
        onCommit={(v) => updateOverrides.mutate({ id: chatId, characterDescription: v || null })}
      />
      <BlurCommitTextarea
        id="cs-personality"
        label="Personality"
        placeholder="Leave empty to use the character card"
        defaultValue={chat?.characterPersonality ?? ""}
        original={config?.character.personality ?? null}
        status={saveState}
        error={updateOverrides.error}
        onRetry={retrySave}
        onRevert={() => updateOverrides.reset()}
        onReset={() => updateOverrides.mutate({ id: chatId, characterPersonality: null })}
        resetLabel="Reset to card"
        onCommit={(v) => updateOverrides.mutate({ id: chatId, characterPersonality: v || null })}
      />
      <BlurCommitTextarea
        id="cs-scenario"
        label="Scenario"
        placeholder="Leave empty to use the character card"
        defaultValue={chat?.characterScenario ?? ""}
        original={config?.character.scenario ?? null}
        status={saveState}
        error={updateOverrides.error}
        onRetry={retrySave}
        onRevert={() => updateOverrides.reset()}
        onReset={() => updateOverrides.mutate({ id: chatId, characterScenario: null })}
        resetLabel="Reset to card"
        onCommit={(v) => updateOverrides.mutate({ id: chatId, characterScenario: v || null })}
      />
      <BlurCommitTextarea
        id="cs-sys-prompt"
        label="Chat system prompt"
        placeholder="Leave empty to use the character card"
        defaultValue={chat?.characterSystemPrompt ?? ""}
        original={config?.character.system_prompt ?? null}
        status={saveState}
        error={updateOverrides.error}
        onRetry={retrySave}
        onRevert={() => updateOverrides.reset()}
        onReset={() => updateOverrides.mutate({ id: chatId, characterSystemPrompt: null })}
        resetLabel="Reset to card"
        onCommit={(v) => updateOverrides.mutate({ id: chatId, characterSystemPrompt: v || null })}
      />
    </div>
  );
}
