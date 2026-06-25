import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCreateLorebookEntry, useUpdateLorebookEntry } from "@/hooks/useLorebooks";
import type { LoreEntry } from "@/db/schema";

export type EntryEditorDialogProps =
  | { lorebookId: string; mode: "create"; onClose: () => void }
  | { lorebookId: string; mode: "edit"; entry: LoreEntry; onClose: () => void };

export function EntryEditorDialog(props: EntryEditorDialogProps) {
  const { lorebookId, mode, onClose } = props;
  const initial = props.mode === "edit" ? props.entry : null;

  const [comment, setComment] = useState(initial?.data.comment ?? "");
  const [content, setContent] = useState(initial?.data.content ?? "");
  const [keysText, setKeysText] = useState((initial?.data.key ?? []).join(", "));
  const [secondaryText, setSecondaryText] = useState((initial?.data.keysecondary ?? []).join(", "));
  const [order, setOrder] = useState(String(initial?.data.order ?? 100));
  const [disable, setDisable] = useState(initial?.data.disable ?? false);
  const [constant, setConstant] = useState(initial?.data.constant ?? false);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateLorebookEntry(lorebookId);
  const updateMutation = useUpdateLorebookEntry(lorebookId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError("Content is required.");
      return;
    }
    const keys = parseKeys(keysText);
    if (keys.length === 0 && !constant) {
      setError("At least one keyword is required (or set Constant).");
      return;
    }
    const orderNum = Number.parseInt(order, 10);
    if (Number.isNaN(orderNum)) {
      setError("Order must be a number.");
      return;
    }
    const secondary = parseKeys(secondaryText);

    try {
      if (mode === "create") {
        await createMutation.mutateAsync({
          comment: comment.trim(),
          content: content.trim(),
          key: keys,
          keysecondary: secondary,
        });
      } else {
        const nextData = {
          ...initial!.data,
          comment: comment.trim(),
          content: content.trim(),
          key: keys,
          keysecondary: secondary,
          order: orderNum,
          disable,
          constant,
        };
        await updateMutation.mutateAsync({
          entryId: initial!.id,
          data: nextData,
          uid: initial!.uid,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New Entry" : "Edit Entry"}</DialogTitle>
          <DialogDescription>
            Keywords activate the entry. Content is injected into the prompt when matched.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comment">Comment</Label>
            <Input
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Short description for the author"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keys">Keywords (comma-separated)</Label>
            <Input
              id="keys"
              value={keysText}
              onChange={(e) => setKeysText(e.target.value)}
              placeholder="dragon, wyrm, drake"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondary">Secondary keys (optional)</Label>
            <Input
              id="secondary"
              value={secondaryText}
              onChange={(e) => setSecondaryText(e.target.value)}
              placeholder="fire, scales"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="The lore text injected into the prompt..."
              disabled={isPending}
              rows={6}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="order">Order</Label>
              <Input
                id="order"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2 pt-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={constant}
                  onChange={(e) => setConstant(e.target.checked)}
                  disabled={isPending}
                  className="size-4"
                />
                Constant (always active)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={disable}
                  onChange={(e) => setDisable(e.target.checked)}
                  disabled={isPending}
                  className="size-4"
                />
                Disabled
              </label>
            </div>
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : mode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function parseKeys(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
