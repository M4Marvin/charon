import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonRows } from "@/components/common/Skeletons";
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
  const navigate = useNavigate();
  const { data: lorebook, isLoading, error, refetch: refetchLorebook } = useLorebook(id);
  const {
    data: entries,
    isLoading: entriesLoading,
    isError: entriesError,
    error: entriesErrorObj,
    refetch: refetchEntries,
  } = useLorebookEntries(id);
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
        <SkeletonRows rows={4} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="Lorebook" backTo="/lorebooks" />
        <ErrorBanner
          message={
            error instanceof Error
              ? `We couldn’t load this lorebook. ${error.message}`
              : "We couldn’t load this lorebook."
          }
          onRetry={() => void refetchLorebook()}
        />
      </main>
    );
  }

  if (!lorebook) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="Lorebook" backTo="/lorebooks" />
        <EmptyState
          icon={BookOpen}
          title="Lorebook not found"
          description="It may have been deleted, or the link may be wrong."
        >
          <Button asChild variant="outline">
            <a href="/lorebooks">Back to lorebooks</a>
          </Button>
        </EmptyState>
      </main>
    );
  }

  const entryList = entries ?? [];
  const query = search.trim().toLowerCase();
  const filtered = entryList.filter((entry) => {
    const matchesFilter =
      showFilter === "all"
        ? true
        : showFilter === "on"
          ? !entry.data.disable && !entry.userDisabled
          : entry.data.disable || entry.userDisabled;
    if (!matchesFilter) return false;
    if (!query) return true;
    const haystack = [
      entry.data.comment,
      entry.data.content,
      ...entry.data.key,
      ...entry.data.keysecondary,
    ]
      .join("\n")
      .toLowerCase();
    return haystack.includes(query);
  });
  const deletingEntry = entryList.find((entry) => entry.id === delEntryId) ?? null;

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <PageHeader
        title={lorebook.name}
        backTo="/lorebooks"
        subtitle={lorebook.description ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!entriesLoading && !entriesError ? (
              <Badge variant="secondary">
                {filtered.length === entryList.length
                  ? `${entryList.length} ${entryList.length === 1 ? "entry" : "entries"}`
                  : `${filtered.length} of ${entryList.length}`}
              </Badge>
            ) : null}
            <Badge variant="outline">
              depth {lorebook.config.depth} · scan {lorebook.config.scanDepth}
            </Badge>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="h-10 pl-9 pr-10"
            placeholder="Search entries..."
            aria-label="Search entries"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="focus-ring absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-2 hover:text-1"
            >
              ×
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <ToggleGroup
            type="single"
            value={showFilter}
            onValueChange={(v) => v && setShowFilter(v as typeof showFilter)}
            aria-label="Filter entries"
          >
            <ToggleGroupItem value="all" className="min-h-10 px-3">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="on" className="min-h-10 px-3">
              On
            </ToggleGroupItem>
            <ToggleGroupItem value="off" className="min-h-10 px-3">
              Off
            </ToggleGroupItem>
          </ToggleGroup>
          <Button size="sm" className="h-10 px-3" onClick={() => setDialog({ kind: "create" })}>
            New Entry
          </Button>
          <RowActionsMenu
            label="Lorebook actions"
            items={[
              { label: "Delete lorebook", destructive: true, onSelect: () => setDelOpen(true) },
            ]}
          />
        </div>
      </div>

      {entriesLoading ? (
        <SkeletonRows rows={4} />
      ) : entriesError ? (
        <ErrorBanner
          message={
            entriesErrorObj instanceof Error
              ? `We couldn’t load the entries. ${entriesErrorObj.message}`
              : "We couldn’t load the entries."
          }
          onRetry={() => void refetchEntries()}
        />
      ) : entryList.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No entries yet"
          description="Add a keyword-triggered entry to this lorebook."
        >
          <Button onClick={() => setDialog({ kind: "create" })}>New Entry</Button>
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No entries match"
          description={
            query ? `No entries match “${search.trim()}”.` : "No entries match the current filter."
          }
        >
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setShowFilter("all");
            }}
          >
            Show all entries
          </Button>
        </EmptyState>
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
        title={`Delete “${lorebook.name}”?`}
        description="This permanently deletes the lorebook and all its entries. This cannot be undone."
        destructive
        loading={deleteLb.isPending}
        onConfirm={() => {
          deleteLb.mutate(
            { id: lorebook.id },
            {
              onSuccess: () => {
                toast.success("Lorebook deleted");
                setDelOpen(false);
                void navigate({ to: "/lorebooks" });
              },
              onError: (err) =>
                toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`),
            },
          );
        }}
      />
      <ConfirmDialog
        open={delEntryId !== null}
        onOpenChange={(o) => !o && setDelEntryId(null)}
        title={
          deletingEntry
            ? `Delete “${deletingEntry.data.comment || `Entry ${deletingEntry.uid}`}”?`
            : "Delete entry?"
        }
        description="This permanently removes the entry from the lorebook. This cannot be undone."
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
  const label = entry.data.comment || `Entry ${entry.uid}`;
  const contentId = `entry-content-${entry.id}`;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex min-h-14 items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
        <StatusDot
          tone={authorDisabled ? "danger" : userDisabled ? "muted" : "success"}
          label={
            authorDisabled ? "Disabled by author" : userDisabled ? "Disabled by you" : "Active"
          }
          className="shrink-0"
          labelClassName="sr-only sm:not-sr-only"
        />
        <button
          type="button"
          onClick={onEdit}
          className="focus-ring min-w-0 flex-1 rounded-md text-left"
          aria-label={`Edit ${label}`}
        >
          <p className="line-clamp-2 text-sm leading-5 sm:line-clamp-1">{label}</p>
          {entry.data.key.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {entry.data.key.slice(0, 3).map((k) => (
                <Badge key={k} variant="secondary" className="text-[11px]">
                  {k}
                </Badge>
              ))}
              {entry.data.key.length > 3 ? (
                <span className="text-2 text-[11px]">+{entry.data.key.length - 3}</span>
              ) : null}
            </div>
          ) : null}
        </button>
        <Badge variant="outline" className="hidden shrink-0 font-mono text-[11px] sm:inline-flex">
          {entry.data.order}
        </Badge>
        <Switch
          checked={effectiveOn}
          disabled={toggle.isPending || authorDisabled}
          onCheckedChange={(c) =>
            toggle.mutate(
              { entryId: entry.id, disabled: !c },
              {
                onError: (err) =>
                  toast.error(
                    `Couldn’t update this entry: ${err instanceof Error ? err.message : String(err)}`,
                  ),
              },
            )
          }
          aria-label={effectiveOn ? `Disable ${label}` : `Enable ${label}`}
        />
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="focus-ring flex size-10 shrink-0 items-center justify-center rounded-full text-2 hover:text-1"
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={expanded}
          aria-controls={contentId}
        >
          <ChevronRight
            className={`size-4 transition-transform ${expanded ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
        </button>
        <RowActionsMenu
          label={`Actions for ${label}`}
          items={[
            { label: "Edit", onSelect: onEdit },
            { label: "Delete", destructive: true, onSelect: onDelete },
          ]}
        />
      </div>
      {expanded ? (
        <div id={contentId} className="border-t px-3 py-3 sm:px-4">
          <p className="whitespace-pre-wrap text-2 text-sm">{entry.data.content}</p>
        </div>
      ) : null}
    </div>
  );
}
