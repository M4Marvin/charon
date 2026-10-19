import { useUserSettings, useUpdateUserSettings } from "@/hooks/useUserSettings";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { BlurCommitTextarea } from "../blur-commit-textarea";
import { SectionHeader } from "../section-header";
import { getSaveState, useSettingsSaveStatus } from "../save-status";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
}

export function PromptsSection(_props: SectionProps) {
  const { data: settings, error, refetch } = useUserSettings();
  const updateUserSettings = useUpdateUserSettings();
  const saveState = getSaveState(updateUserSettings);
  const retrySave = updateUserSettings.variables
    ? () => updateUserSettings.mutate(updateUserSettings.variables!)
    : undefined;

  useSettingsSaveStatus("prompts", saveState, {
    retry: retrySave,
    at: updateUserSettings.submittedAt,
    error: updateUserSettings.error,
  });

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Global prompts"
        description="Prompts used in every chat."
        scope="global"
      />

      {error ? (
        <ErrorBanner
          message={error instanceof Error ? error.message : "Failed to load prompts"}
          onRetry={() => void refetch()}
        />
      ) : null}

      <BlurCommitTextarea
        id="ps-system"
        label="System prompt"
        description="Sent at the start of every conversation."
        placeholder="Write the global system prompt."
        defaultValue={settings?.systemPrompt ?? ""}
        onCommit={(v) => updateUserSettings.mutate({ systemPrompt: v || null })}
      />
      <BlurCommitTextarea
        id="ps-post-history"
        label="Additional instructions"
        description="Added to the system prompt for every chat."
        placeholder="Optional instructions for every reply."
        defaultValue={settings?.postHistoryInstructions ?? ""}
        onCommit={(v) => updateUserSettings.mutate({ postHistoryInstructions: v || null })}
      />
      <BlurCommitTextarea
        id="ps-impersonate"
        label="Impersonation prompt"
        description="Used when generating an impersonated reply."
        placeholder="Optional guidance for impersonation."
        defaultValue={settings?.impersonationPrompt ?? ""}
        onCommit={(v) => updateUserSettings.mutate({ impersonationPrompt: v || null })}
      />
    </div>
  );
}
