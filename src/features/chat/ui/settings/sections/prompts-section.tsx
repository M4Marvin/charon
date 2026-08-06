import { useUserSettings, useUpdateUserSettings } from "@/hooks/useUserSettings";
import { BlurCommitTextarea } from "../blur-commit-textarea";
import { SectionHeader } from "../section-header";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
  isAdmin: boolean;
}

export function PromptsSection(_props: SectionProps) {
  const { data: settings } = useUserSettings();
  const updateUserSettings = useUpdateUserSettings();

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title="Prompts" />

      <BlurCommitTextarea
        id="ps-system"
        label="System prompt"
        placeholder="Sent at the start of every conversation."
        defaultValue={settings?.systemPrompt ?? ""}
        onCommit={(v) => updateUserSettings.mutate({ systemPrompt: v || null })}
      />
      <BlurCommitTextarea
        id="ps-post-history"
        label="Post-history instructions"
        placeholder="Injected after chat history, before the last message."
        defaultValue={settings?.postHistoryInstructions ?? ""}
        onCommit={(v) => updateUserSettings.mutate({ postHistoryInstructions: v || null })}
      />
      <BlurCommitTextarea
        id="ps-impersonate"
        label="Impersonation prompt"
        placeholder="Replaces system prompts when using impersonate."
        defaultValue={settings?.impersonationPrompt ?? ""}
        onCommit={(v) => updateUserSettings.mutate({ impersonationPrompt: v || null })}
      />
      <BlurCommitTextarea
        id="ps-image-prompt-example"
        label="Image prompt example"
        placeholder="Reference format for generated image prompts (danbooru tags)."
        defaultValue={settings?.imagePromptExample ?? ""}
        onCommit={(v) => updateUserSettings.mutate({ imagePromptExample: v || null })}
      />
    </div>
  );
}
