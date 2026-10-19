import { useUserSettings, useUpdateUserSettings } from "@/hooks/useUserSettings";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { BlurCommitTextarea } from "../blur-commit-textarea";
import { SectionHeader } from "../section-header";
import { SaveStatus, getSaveState } from "../save-status";

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

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Global prompts"
        description="Prompts used in every chat."
        scope="global"
      />
      <SaveStatus state={saveState} error={updateUserSettings.error} onRetry={retrySave} />

      {error ? (
        <ErrorBanner
          message={error instanceof Error ? error.message : "Failed to load prompts"}
          onRetry={() => void refetch()}
        />
      ) : null}

      <BlurCommitTextarea
        id="ps-system"
        label="System prompt"
        placeholder="Sent at the start of every conversation."
        defaultValue={settings?.systemPrompt ?? ""}
        status={saveState}
        error={updateUserSettings.error}
        onRetry={retrySave}
        onRevert={() => updateUserSettings.reset()}
        onCommit={(v) => updateUserSettings.mutate({ systemPrompt: v || null })}
      />
      <BlurCommitTextarea
        id="ps-post-history"
        label="Post-history instructions"
        placeholder="Injected after chat history, before the last message."
        defaultValue={settings?.postHistoryInstructions ?? ""}
        status={saveState}
        error={updateUserSettings.error}
        onRetry={retrySave}
        onRevert={() => updateUserSettings.reset()}
        onCommit={(v) => updateUserSettings.mutate({ postHistoryInstructions: v || null })}
      />
      <BlurCommitTextarea
        id="ps-impersonate"
        label="Impersonation prompt"
        placeholder="Replaces system prompts when using impersonate."
        defaultValue={settings?.impersonationPrompt ?? ""}
        status={saveState}
        error={updateUserSettings.error}
        onRetry={retrySave}
        onRevert={() => updateUserSettings.reset()}
        onCommit={(v) => updateUserSettings.mutate({ impersonationPrompt: v || null })}
      />
    </div>
  );
}
