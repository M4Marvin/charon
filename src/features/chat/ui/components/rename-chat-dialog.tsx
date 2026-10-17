import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RenameChatDialogProps {
  chat: { id: string; title: string } | null;
  loading: boolean;
  onClose: () => void;
  onRename: (id: string, title: string) => void;
}

export function RenameChatDialog(props: RenameChatDialogProps) {
  const { chat } = props;
  if (!chat) return null;
  // Key by chat id so the form state is seeded from the title of the chat
  // currently being renamed, not from a previous one.
  return <RenameChatForm key={chat.id} {...props} chat={chat} />;
}

type RenameChatFormProps = RenameChatDialogProps & {
  chat: { id: string; title: string };
};

function RenameChatForm({ chat, loading, onClose, onRename }: RenameChatFormProps) {
  const [title, setTitle] = useState(chat.title);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title cannot be empty.");
      return;
    }
    if (trimmed === chat.title) {
      onClose();
      return;
    }
    setError(null);
    onRename(chat.id, trimmed);
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Chat</DialogTitle>
          <DialogDescription>Enter a new title for this chat.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          noValidate
          onKeyDown={(e) => {
            if (e.key === "Enter") e.stopPropagation();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="rename-title">Title</Label>
            <Input
              id="rename-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "rename-title-error" : undefined}
              disabled={loading}
              autoFocus
              required
              minLength={1}
            />
          </div>
          {error ? (
            <p id="rename-title-error" role="alert" className="text-danger text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
