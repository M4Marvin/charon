import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { StatusDot } from "@/components/common/StatusDot";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import {
  useDeleteLorebookEntry,
  useDeleteLorebook,
  useLorebook,
  useLorebookEntries,
  useToggleLoreEntry,
} from "@/hooks/useLorebooks";
import { EntryEditorSheet } from "@/components/lorebook/EntryEditorSheet";
import type { LoreEntryListItem } from "@/server/fns/lorebooks";

type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; entry: LoreEntryListItem };

export const Route = createFileRoute("/lorebooks/$id")({
  component: LorebookDetailPage,
});

function LorebookDetailPage() {
  const { id } = Route.useParams();
  const { data: lorebook, isLoading, error } = useLorebook(id);
  const { data: entries } = useLorebookEntries(id);
  const deleteLb = useDeleteLorebook();
  const deleteEntry = useDeleteLorebookEntry(id);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
  const [delOpen, setDelOpen] = useState(false);
  const [delEntryId, setDelEntryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState<"all" | "on" | "off">("all");

  if (isLoading) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader backTo="/lorebooks" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="Lorebook" backTo="/lorebooks" />
        <ErrorBanner message={(error as Error).message ?? "Failed to load lorebook"} />
      </main>
    );
  }

  if (!lorebook) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="Lorebook" backTo="/lorebooks" />
        <ErrorBanner message="Lorebook not found." />
      </main>
    );
  }

  const entryList = entries ?? [];
  const filtered = entryList.filter((e) => {
    if (showFilter === "on") return !e.data.disable && !e.userDisabled;
    if (showFilter === "off") return e.data.disable || e.userDisabled;
    return true;
  });

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <PageHeader
        title={lorebook.name}
        backTo="/lorebooks"
        subtitle={lorebook.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {entryList.length} {entryList.length === 1 ? "entry" : "entries"}
            </Badge>
            <Badge variant="outline">
              depth {lorebook.config.depth} · scan {lorebook.config.scanDepth}
            </Badge>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Input
          className="flex-1 max-w-sm"
          placeholder="Search entries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ToggleGroup
          type="single"
          value={showFilter}
          onValueChange={(v) => v && setShowFilter(v as typeof showFilter)}
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="on">On</ToggleGroupItem>
          <ToggleGroupItem value="off">Off</ToggleGroupItem>
        </ToggleGroup>
        <Button size="sm" onClick={() => setDialog({ kind: "create" })}>
          New Entry
        </Button>
        <RowActionsMenu
          label="Lorebook actions"
          items={[
            { label: "Delete lorebook", destructive: true, onSelect: () => setDelOpen(true) },
          ]}
        />
      </div>

      {entryList.length === 0 ? (
        <p className="py-12 text-center text-2 text-sm">
          No entries yet. Click "New Entry" to add one.
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-2 text-sm">No entries match the current filter.</p>
      ) : (
        <div className="space-y-1">
          {filtered.map((entry) => (
            <EntryRow
              key={entry.id}
              lorebookId={id}
              entry={entry}
              onEdit={() => setDialog({ kind: "edit", entry })}
              onDelete={() => setDelEntryId(entry.id)}
            />
          ))}
        </div>
      )}

      {dialog.kind === "create" ? (
        <EntryEditorSheet
          lorebookId={id}
          mode="create"
          onClose={() => setDialog({ kind: "closed" })}
        />
      ) : null}
      {dialog.kind === "edit" ? (
        <EntryEditorSheet
          lorebookId={id}
          mode="edit"
          entry={dialog.entry}
          onClose={() => setDialog({ kind: "closed" })}
        />
      ) : null}

      <ConfirmDialog
        open={delOpen}
        onOpenChange={(o) => !o && setDelOpen(false)}
        title="Delete lorebook"
        description="This will permanently delete this lorebook and all its entries. This action cannot be undone."
        destructive
        loading={deleteLb.isPending}
        onConfirm={() => {
          deleteLb.mutate(
            { id: lorebook.id },
            {
              onSuccess: () => toast.success("Lorebook deleted"),
              onError: (err) =>
                toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`),
            },
          );
        }}
      />
      <ConfirmDialog
        open={delEntryId !== null}
        onOpenChange={(o) => !o && setDelEntryId(null)}
        title="Delete entry"
        description="This entry will be permanently removed from the lorebook."
        destructive
        loading={deleteEntry.isPending}
        onConfirm={() => {
          if (!delEntryId) return;
          deleteEntry.mutate(
            { entryId: delEntryId },
            {
              onSuccess: () => {
                toast.success("Entry deleted");
                setDelEntryId(null);
              },
              onError: (err) =>
                toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`),
            },
          );
        }}
      />
    </main>
  );
}

function EntryRow({
  lorebookId,
  entry,
  onEdit,
  onDelete,
}: {
  lorebookId: string;
  entry: LoreEntryListItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const toggle = useToggleLoreEntry(lorebookId);
  const authorDisabled = entry.data.disable === true;
  const userDisabled = entry.userDisabled === true;
  const effectiveOn = !authorDisabled && !userDisabled;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-3 px-4 py-3 min-h-14">
        {authorDisabled ? (
          <StatusDot tone="danger" label="Disabled by author" />
        ) : userDisabled ? (
          <StatusDot tone="muted" label="Disabled by you" />
        ) : (
          <StatusDot tone="success" label="Active" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{entry.data.comment || `Entry ${entry.uid}`}</p>
          {entry.data.key.length > 0 ? (
            <div className="flex gap-1 mt-0.5">
              {entry.data.key.slice(0, 3).map((k) => (
                <Badge key={k} variant="secondary" className="text-[10px]">
                  {k}
                </Badge>
              ))}
              {entry.data.key.length > 3 ? (
                <span className="text-3 text-[10px]">+{entry.data.key.length - 3}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px] font-mono">
          {entry.data.order}
        </Badge>
        <Switch
          checked={effectiveOn}
          disabled={toggle.isPending || authorDisabled}
          onCheckedChange={(c) => toggle.mutate({ entryId: entry.id, disabled: !c })}
        />
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-2 hover:text-1 shrink-0 size-8 flex items-center justify-center"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>▸</span>
        </button>
        <RowActionsMenu
          label={`Actions for ${entry.data.comment || `Entry ${entry.uid}`}`}
          items={[
            { label: "Edit", onSelect: onEdit },
            { label: "Delete", destructive: true, onSelect: onDelete },
          ]}
        />
      </div>
      {expanded ? (
        <div className="border-t px-4 py-3">
          <p className="text-2 text-sm line-clamp-3">{entry.data.content}</p>
        </div>
      ) : null}
    </div>
  );
}
