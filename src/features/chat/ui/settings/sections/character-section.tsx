import { useChatConfig } from "@/hooks/useChatConfig";
import { useUpdateChatOverrides } from "@/hooks/useChatConfig";
import { BlurCommitTextarea } from "../blur-commit-textarea";
import { SectionHeader } from "../section-header";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
  isAdmin: boolean;
}

export function CharacterSection({ chatId, isStreaming }: SectionProps) {
  const { data: config } = useChatConfig(chatId);
  const updateOverrides = useUpdateChatOverrides();

  const chat = config?.chat;

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title="Character overrides" />

      <BlurCommitTextarea
        id="cs-desc"
        label="Description"
        placeholder={
          config?.character.description
            ? `Original: ${config.character.description.slice(0, 60)}…`
            : "Character description"
        }
        defaultValue={chat?.characterDescription ?? ""}
        onCommit={(v) => updateOverrides.mutate({ id: chatId, characterDescription: v || null })}
        disabled={isStreaming}
      />
      <BlurCommitTextarea
        id="cs-personality"
        label="Personality"
        placeholder={
          config?.character.personality
            ? `Original: ${config.character.personality.slice(0, 60)}…`
            : "Character personality"
        }
        defaultValue={chat?.characterPersonality ?? ""}
        onCommit={(v) => updateOverrides.mutate({ id: chatId, characterPersonality: v || null })}
        disabled={isStreaming}
      />
      <BlurCommitTextarea
        id="cs-scenario"
        label="Scenario"
        placeholder={
          config?.character.scenario
            ? `Original: ${config.character.scenario.slice(0, 60)}…`
            : "Character scenario"
        }
        defaultValue={chat?.characterScenario ?? ""}
        onCommit={(v) => updateOverrides.mutate({ id: chatId, characterScenario: v || null })}
        disabled={isStreaming}
      />
      <BlurCommitTextarea
        id="cs-sys-prompt"
        label="System prompt"
        placeholder={
          config?.character.system_prompt
            ? `Original: ${config.character.system_prompt.slice(0, 60)}…`
            : "Character system prompt"
        }
        defaultValue={chat?.characterSystemPrompt ?? ""}
        onCommit={(v) => updateOverrides.mutate({ id: chatId, characterSystemPrompt: v || null })}
        disabled={isStreaming}
      />
    </div>
  );
}
