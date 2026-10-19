import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { SkeletonText } from "@/components/common/Skeletons";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SettingsCard, SettingsCardRows, SettingsRow } from "@/components/settings/settings-ui";
import { useChatConfig } from "@/hooks/useChatConfig";
import { useDeleteChat, useRenameChat } from "@/hooks/useChats";
import { SectionHeader } from "../section-header";
import { getSaveState, useSettingsSaveStatus } from "../save-status";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
  onClose: () => void;
  messageCount?: number;
}

export function ChatDetailsSection({ chatId, isStreaming, onClose, messageCount }: SectionProps) {
  const { data: config } = useChatConfig(chatId);

  if (!config) {
    return (
      <div className="flex flex-col gap-5" role="status">
        <SectionHeader title="Chat details" description="Rename or delete this chat." />
        <SkeletonText lines={2} />
        <span className="sr-only">Loading chat details</span>
      </div>
    );
  }

  return (
    <ChatDetailsForm
      key={config.chat.id}
      chatId={chatId}
      title={config.chat.title}
      characterName={config.character.name}
      createdAt={config.chat.createdAt}
      messageCount={messageCount ?? 0}
      isStreaming={isStreaming}
      onClose={onClose}
    />
  );
}

interface ChatDetailsFormProps {
  chatId: string;
  title: string;
  characterName: string;
  createdAt: Date;
  messageCount: number;
  isStreaming: boolean;
  onClose: () => void;
}

function ChatDetailsForm({
  chatId,
  title,
  characterName,
  createdAt,
  messageCount,
  isStreaming,
  onClose,
}: ChatDetailsFormProps) {
  const navigate = useNavigate();
  const renameChat = useRenameChat();
  const deleteChat = useDeleteChat();
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  const retryRename = renameChat.variables
    ? () => renameChat.mutate(renameChat.variables!)
    : undefined;
  useSettingsSaveStatus("chat-details", getSaveState(renameChat), {
    retry: retryRename,
    at: renameChat.submittedAt,
    error: renameChat.error,
  });

  const trimmed = draft.trim();
  const commitRename = () => {
    if (renameChat.isPending) return;
    if (!trimmed) {
      setError("Give this chat a title.");
      return;
    }
    if (trimmed === title) {
      setError(null);
      return;
    }
    setError(null);
    renameChat.mutate({ id: chatId, title: trimmed });
  };

  const handleDelete = () => {
    deleteChat.mutate(
      { id: chatId },
      {
        onSuccess: () => {
          toast.success("Chat deleted");
          onClose();
          navigate({ to: "/chat" });
        },
        onError: (err) => {
          console.error("[settings] delete chat failed", err);
          toast.error("Couldn't delete this chat. Please try again.");
        },
      },
    );
  };

  const created = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(createdAt);
  const messageLabel = `${messageCount} ${messageCount === 1 ? "message" : "messages"}`;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Chat details"
        description="Rename, review, or delete this conversation."
      />

      <SettingsCard>
        <SettingsCardRows>
          <SettingsRow label="Character">
            <span className="max-w-48 truncate text-[13px] text-1">{characterName}</span>
          </SettingsRow>
          <SettingsRow label="Created">
            <span className="text-[13px] text-2">{created}</span>
          </SettingsRow>
          <SettingsRow label="Messages">
            <span className="text-[13px] tabular-nums text-2">{messageCount}</span>
          </SettingsRow>
        </SettingsCardRows>
      </SettingsCard>

      <Field className="space-y-2">
        <FieldLabel htmlFor="chat-title">Chat title</FieldLabel>
        <Input
          id="chat-title"
          className="h-11"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitRename();
            }
            if (event.key === "Escape") {
              setDraft(title);
              setError(null);
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "chat-title-error" : undefined}
          disabled={renameChat.isPending}
        />
        {error ? (
          <p id="chat-title-error" role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : (
          <p className="text-xs text-2">Press Enter or click away to save.</p>
        )}
      </Field>

      <SettingsCard className="border-danger/20 bg-danger/5">
        <div className="p-4">
          <p className="text-[13px] font-medium text-danger">Delete chat</p>
          <p className="mt-1 text-xs leading-relaxed text-2">
            Permanently deletes “{title}” and its {messageLabel}. This cannot be undone.
          </p>
          <Button
            ref={deleteButtonRef}
            type="button"
            variant="outline"
            className="mt-3 min-h-11 gap-2 border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
            disabled={isStreaming || deleteChat.isPending}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete chat
          </Button>
          {isStreaming ? (
            <p className="mt-2 text-xs text-2">Stop the current reply before deleting this chat.</p>
          ) : null}
        </div>
      </SettingsCard>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete chat?"
        description={`This permanently deletes “${title}” and its ${messageLabel}. This cannot be undone.`}
        destructive
        loading={deleteChat.isPending}
        returnFocusTo={deleteButtonRef}
        onConfirm={handleDelete}
      />
    </div>
  );
}
