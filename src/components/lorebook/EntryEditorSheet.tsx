import { useMemo, useState, type FormEvent } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ChipInput } from "@/components/common/ChipInput";
import { useCreateLorebookEntry, useUpdateLorebookEntry } from "@/hooks/useLorebooks";
import { ApproxTokenCounter } from "@/lib/st-core/shared";
import type { LoreEntryListItem } from "@/server/fns/lorebooks";

const counter = new ApproxTokenCounter();

type Props =
  | { lorebookId: string; mode: "create"; onClose: () => void }
  | { lorebookId: string; mode: "edit"; entry: LoreEntryListItem; onClose: () => void };

export function EntryEditorSheet(props: Props) {
  const { lorebookId, mode, onClose } = props;
  const initial = props.mode === "edit" ? props.entry : null;

  const [comment, setComment] = useState(initial?.data.comment ?? "");
  const [keys, setKeys] = useState(initial?.data.key ?? ([] as string[]));
  const [secondary, setSecondary] = useState(initial?.data.keysecondary ?? ([] as string[]));
  const [content, setContent] = useState(initial?.data.content ?? "");
  const [order, setOrder] = useState(String(initial?.data.order ?? 100));
  const [disable, setDisable] = useState(initial?.data.disable ?? false);
  const [constant, setConstant] = useState(initial?.data.constant ?? false);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateLorebookEntry(lorebookId);
  const updateMutation = useUpdateLorebookEntry(lorebookId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const tokenCount = useMemo(() => counter.count(content), [content]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!content.trim()) {
      setError("Content is required.");
      return;
    }
    if (keys.length === 0 && !constant) {
      setError("At least one keyword is required (or set Constant).");
      return;
    }
    const orderNum = Number.parseInt(order, 10);
    if (Number.isNaN(orderNum)) {
      setError("Order must be a number.");
      return;
    }
    try {
      if (mode === "create") {
        const orderNum = Number.parseInt(order, 10);
        await createMutation.mutateAsync({
          comment: comment.trim(),
          content: content.trim(),
          key: keys,
          keysecondary: secondary,
          order: Number.isNaN(orderNum) ? undefined : orderNum,
          disable,
          constant,
        });
      } else {
        await updateMutation.mutateAsync({
          entryId: initial!.id,
          uid: initial!.uid,
          data: {
            ...initial!.data,
            comment: comment.trim(),
            content: content.trim(),
            key: keys,
            keysecondary: secondary,
            order: orderNum,
            disable,
            constant,
          },
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{mode === "create" ? "New Entry" : "Edit Entry"}</SheetTitle>
          <SheetDescription>
            Keywords activate the entry. Content is injected into the prompt when matched.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label htmlFor="comment">Comment</Label>
            <Input
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Short description for the author"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Keywords</Label>
            <ChipInput value={keys} onChange={setKeys} placeholder="dragon, wyrm, drake" />
          </div>
          <div className="space-y-1.5">
            <Label>Secondary keys</Label>
            <ChipInput value={secondary} onChange={setSecondary} placeholder="fire, scales" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="The lore text injected into the prompt..."
              rows={6}
              required
              disabled={isPending}
            />
            <p className="text-3 text-xs text-right">~{tokenCount} tokens</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
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
                <Switch checked={constant} onCheckedChange={setConstant} disabled={isPending} />
                Constant (always active)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={disable} onCheckedChange={setDisable} disabled={isPending} />
                Disabled
              </label>
            </div>
          </div>
          {error ? <p className="text-danger text-sm">{error}</p> : null}
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
