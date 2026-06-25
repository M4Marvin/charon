import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useDeleteLorebookEntry,
  useLorebook,
  useLorebookEntries,
  useToggleLoreEntry,
} from "@/hooks/useLorebooks";
import { EntryEditorDialog } from "@/components/lorebook/EntryEditorDialog";
import type { LoreEntry } from "@/db/schema";

type DialogState = { kind: "closed" } | { kind: "create" } | { kind: "edit"; entry: LoreEntry };

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
                  {entries?.length ?? 0} {(entries?.length ?? 0) === 1 ? "entry" : "entries"}
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
        <EntryEditorDialog lorebookId={id} mode="create" onClose={() => setDialog({ kind: "closed" })} />
      ) : null}
      {dialog.kind === "edit" ? (
        <EntryEditorDialog
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
        onCheckedChange={(checked) => toggle.mutate({ entryId: entry.id, disabled: !checked })}
        aria-label={`Toggle ${entry.data.comment || `entry ${entry.uid}`}`}
      />
      <span className="text-muted-foreground text-xs">
        {userDisabled ? "you" : effectiveOn ? "on" : "off"}
      </span>
    </div>
  );
}
