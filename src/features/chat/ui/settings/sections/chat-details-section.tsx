import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { SkeletonText } from "@/components/common/Skeletons";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useChatConfig } from "@/hooks/useChatConfig";
import { useDeleteChat, useRenameChat } from "@/hooks/useChats";
import { SectionHeader } from "../section-header";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
  onClose: () => void;
}

export function ChatDetailsSection({ chatId, isStreaming, onClose }: SectionProps) {
  const { data: config } = useChatConfig(chatId);

  if (!config) {
    return (
      <div className="flex flex-col gap-5" role="status">
        <SectionHeader
          title="Chat details"
          description="Rename or delete this chat."
          scope="chat"
        />
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
  isStreaming: boolean;
  onClose: () => void;
}

function ChatDetailsForm({
  chatId,
  title,
  characterName,
  createdAt,
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

  const trimmed = draft.trim();
  const dirty = trimmed !== title;

  const handleRename = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed) {
      setError("Title cannot be empty.");
      return;
    }
    if (!dirty) return;
    setError(null);
    renameChat.mutate(
      { id: chatId, title: trimmed },
      {
        onSuccess: () => toast.success("Chat renamed"),
        onError: (err) =>
          setError(err instanceof Error ? err.message : "Rename failed. Please try again."),
      },
    );
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
        onError: (err) =>
          toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`),
      },
    );
  };

  const created = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(createdAt);

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title="Chat details" description="Rename or delete this chat." scope="chat" />

      <div className="rounded-xl border border-subtle bg-surface p-4">
        <p className="text-sm font-medium text-1">{characterName}</p>
        <p className="mt-1 text-xs text-2">Created {created}</p>
      </div>

      <form onSubmit={handleRename} className="flex flex-col gap-2">
        <Field className="space-y-1.5">
          <FieldLabel htmlFor="chat-title">Chat title</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="chat-title"
              className="h-10 max-sm:h-11"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "chat-title-error" : undefined}
              disabled={renameChat.isPending}
            />
            <Button
              type="submit"
              className="h-10 max-sm:h-11"
              disabled={!dirty || !trimmed || renameChat.isPending}
            >
              {renameChat.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </Field>
        {error ? (
          <p id="chat-title-error" role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
      </form>

      <div className="rounded-xl border border-subtle bg-surface p-4">
        <p className="text-sm font-medium text-1">Danger zone</p>
        <p className="mt-1 text-xs text-2">
          Deleting this chat removes its messages and cannot be undone.
        </p>
        <Button
          ref={deleteButtonRef}
          type="button"
          variant="outline"
          className="mt-3 min-h-11 gap-2 text-danger"
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

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete chat?"
        description="This permanently deletes the chat and all its messages. This cannot be undone."
        destructive
        loading={deleteChat.isPending}
        returnFocusTo={deleteButtonRef}
        onConfirm={handleDelete}
      />
    </div>
  );
}
