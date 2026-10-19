import { toast } from "sonner";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/useUserSettings";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { BlurCommitTextarea } from "../blur-commit-textarea";
import { SectionHeader } from "../section-header";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
}

export function PromptsSection(_props: SectionProps) {
  const { data: settings, error, refetch } = useUserSettings();
  const updateUserSettings = useUpdateUserSettings();

  const onSaveError = (err: unknown) =>
    toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`);

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title="Prompts" />

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
        onCommit={(v) =>
          updateUserSettings.mutate({ systemPrompt: v || null }, { onError: onSaveError })
        }
      />
      <BlurCommitTextarea
        id="ps-post-history"
        label="Post-history instructions"
        placeholder="Injected after chat history, before the last message."
        defaultValue={settings?.postHistoryInstructions ?? ""}
        onCommit={(v) =>
          updateUserSettings.mutate(
            { postHistoryInstructions: v || null },
            { onError: onSaveError },
          )
        }
      />
      <BlurCommitTextarea
        id="ps-impersonate"
        label="Impersonation prompt"
        placeholder="Replaces system prompts when using impersonate."
        defaultValue={settings?.impersonationPrompt ?? ""}
        onCommit={(v) =>
          updateUserSettings.mutate({ impersonationPrompt: v || null }, { onError: onSaveError })
        }
      />
    </div>
  );
}
