import { MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CharacterActions({
  onStartChat,
  onRename,
  onDelete,
  deletePending,
}: {
  onStartChat: () => void;
  onRename: () => void;
  onDelete: () => void;
  deletePending: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onStartChat}>
        <MessageCircle className="size-4" />
        Start Chat
      </Button>
      <Button onClick={onRename} variant="outline" size="sm">
        <Pencil className="size-4" />
        Rename
      </Button>
      <Button onClick={onDelete} variant="destructive" size="sm" disabled={deletePending}>
        <Trash2 className="size-4" />
        {deletePending ? "Deleting..." : "Delete"}
      </Button>
    </div>
  );
}
