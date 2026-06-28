import { Edit, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CharacterActions({
  onStartChat,
  onEdit,
  onRename,
  onDelete,
  deletePending,
  isDemo,
}: {
  onStartChat: () => void;
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
  deletePending: boolean;
  isDemo?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onStartChat}>
        <MessageCircle className="size-4" />
        Start Chat
      </Button>
      {!isDemo && (
        <>
          <Button onClick={onEdit} variant="outline" size="sm">
            <Edit className="size-4" />
            Edit
          </Button>
          <Button onClick={onRename} variant="outline" size="sm">
            <Pencil className="size-4" />
            Rename
          </Button>
          <Button onClick={onDelete} variant="destructive" size="sm" disabled={deletePending}>
            <Trash2 className="size-4" />
            {deletePending ? "Deleting..." : "Delete"}
          </Button>
        </>
      )}
    </div>
  );
}
