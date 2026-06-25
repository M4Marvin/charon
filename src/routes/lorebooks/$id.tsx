import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateLorebookEntry,
  useDeleteLorebookEntry,
  useLorebook,
  useLorebookEntries,
  useToggleLoreEntry,
  useUpdateLorebookEntry,
} from "@/hooks/useLorebooks";
import type { LoreEntry } from "@/db/schema";

type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; entry: LoreEntry };

export const Route = createFileRoute("/lorebooks/$id")({
  component: LorebookDetailPage,
});

function LorebookDetailPage() {
  const { id } = Route.useParams();
  const { data: lorebook, isLoading, error } = useLorebook(id);
  const { data: entries } = useLorebookEntries(id);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3">
            <Link to="/lorebooks">← Back</Link>
          </Button>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : error ? (
            <p className="text-destructive text-sm">Failed to load: {error.message}</p>
          ) : lorebook ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">{lorebook.name}</h1>
              {lorebook.description ? (
                <p className="text-muted-foreground text-sm">{lorebook.description}</p>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary">
                  {entries?.length ?? 0}{" "}
                  {(entries?.length ?? 0) === 1 ? "entry" : "entries"}
                </Badge>
                <Badge variant="outline">
                  depth {lorebook.config.depth} · scan {lorebook.config.scanDepth}
                </Badge>
              </div>
            </>
          ) : null}
        </div>
        <Button onClick={() => setDialog({ kind: "create" })}>New Entry</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
          <CardDescription>
            Each entry's keywords activate it; its content is injected when triggered.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!entries || entries.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No entries yet. Click "New Entry" to add one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">UID</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Keys</TableHead>
                  <TableHead className="w-16">Order</TableHead>
                  <TableHead className="w-32">On</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs">{entry.uid}</TableCell>
                    <TableCell className="line-clamp-1 max-w-md">
                      {entry.data.comment || (
                        <span className="text-muted-foreground italic">no comment</span>
                      )}
                    </TableCell>
                    <TableCell className="line-clamp-1 max-w-xs font-mono text-xs">
                      {entry.data.key.join(", ") || (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.data.order}</TableCell>
                    <TableCell>
                      <EntryToggleCell lorebookId={id} entry={entry} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDialog({ kind: "edit", entry })}
                        >
                          Edit
                        </Button>
                        <DeleteEntryButton lorebookId={id} entryId={entry.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {dialog.kind === "create" ? (
        <EntryDialog
          lorebookId={id}
          mode="create"
          onClose={() => setDialog({ kind: "closed" })}
        />
      ) : null}
      {dialog.kind === "edit" ? (
        <EntryDialog
          lorebookId={id}
          mode="edit"
          entry={dialog.entry}
          onClose={() => setDialog({ kind: "closed" })}
        />
      ) : null}
    </main>
  );
}

function DeleteEntryButton({ lorebookId, entryId }: { lorebookId: string; entryId: string }) {
  const deleteMutation = useDeleteLorebookEntry(lorebookId);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={deleteMutation.isPending}
      onClick={() => {
        if (window.confirm("Delete this entry?")) {
          deleteMutation.mutate({ entryId });
        }
      }}
    >
      Delete
    </Button>
  );
}

type EntryDialogProps =
  | { lorebookId: string; mode: "create"; onClose: () => void }
  | { lorebookId: string; mode: "edit"; entry: LoreEntry; onClose: () => void };

function EntryDialog(props: EntryDialogProps) {
  const { lorebookId, mode, onClose } = props;
  const initial = props.mode === "edit" ? props.entry : null;

  const [comment, setComment] = useState(initial?.data.comment ?? "");
  const [content, setContent] = useState(initial?.data.content ?? "");
  const [keysText, setKeysText] = useState((initial?.data.key ?? []).join(", "));
  const [secondaryText, setSecondaryText] = useState(
    (initial?.data.keysecondary ?? []).join(", "),
  );
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

// Per-entry enable toggle. Effective on = !data.disable && !userDisabled.
// AND semantics: if the author disabled the entry, the per-user switch is
// locked off (it can't re-enable a globally-disabled entry).
function EntryToggleCell({
  lorebookId,
  entry,
}: {
  lorebookId: string;
  entry: LoreEntry & { userDisabled: boolean };
}) {
  const toggle = useToggleLoreEntry(lorebookId);
  const authorDisabled = entry.data.disable === true;
  const userDisabled = entry.userDisabled === true;
  const effectiveOn = !authorDisabled && !userDisabled;

  if (authorDisabled) {
    return (
      <div className="flex items-center gap-2">
        <Switch checked={false} disabled aria-label="Disabled by author" />
        <span className="text-muted-foreground text-xs">author</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={effectiveOn}
        disabled={toggle.isPending}
        onCheckedChange={(checked) =>
          toggle.mutate({ entryId: entry.id, disabled: !checked })
        }
        aria-label={`Toggle ${entry.data.comment || `entry ${entry.uid}`}`}
      />
      <span className="text-muted-foreground text-xs">
        {userDisabled ? "you" : effectiveOn ? "on" : "off"}
      </span>
    </div>
  );
}
