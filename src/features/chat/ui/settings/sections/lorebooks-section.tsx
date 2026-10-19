import { useCallback, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { SkeletonText } from "@/components/common/Skeletons";
import {
  useLorebooks,
  useToggleLorebook,
  useLorebookEntries,
  useToggleLoreEntry,
  useCreateLorebook,
  useDeleteLorebook,
  useDeleteLorebookEntry,
} from "@/hooks/useLorebooks";
import { ImportLorebookDialog } from "@/components/lorebook/ImportLorebookDialog";
import { EntryEditorSheet } from "@/components/lorebook/EntryEditorSheet";
import type { LoreEntryListItem } from "@/server/fns/lorebooks";
import { SectionHeader } from "../section-header";
import { getSaveState, useSettingsSaveStatus } from "../save-status";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
}

type EntryDialog =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; entry: LoreEntryListItem };

export function LorebooksSection(_props: SectionProps) {
  const {
    data: lorebooks,
    isLoading: lorebooksLoading,
    error: lorebooksError,
    refetch: refetchLorebooks,
  } = useLorebooks();
  const toggleLorebook = useToggleLorebook();
  const retrySave = toggleLorebook.variables
    ? () => toggleLorebook.mutate(toggleLorebook.variables!)
    : undefined;
  useSettingsSaveStatus("lorebooks", getSaveState(toggleLorebook), {
    retry: retrySave,
    at: toggleLorebook.submittedAt,
    error: toggleLorebook.error,
  });
  const createLorebook = useCreateLorebook();
  const deleteLorebook = useDeleteLorebook();

  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newError, setNewError] = useState<string | null>(null);
  const [delBookId, setDelBookId] = useState<string | null>(null);

  const handleToggle = useCallback(
    (lorebookId: string, enabled: boolean) => {
      toggleLorebook.mutate({ lorebookId, enabled });
    },
    [toggleLorebook],
  );

  const handleCreateNew = useCallback(async () => {
    if (!newName.trim()) {
      setNewError("Name is required.");
      return;
    }
    setNewError(null);
    try {
      const result = await createLorebook.mutateAsync({
        name: newName.trim(),
        ...(newDescription.trim() ? { description: newDescription.trim() } : {}),
      });
      toast.success("Lorebook created");
      setNewName("");
      setNewDescription("");
      setNewOpen(false);
      setExpandedId(result.id);
    } catch (err) {
      console.error("[settings] create lorebook failed", err);
      setNewError("Couldn't create this lorebook. Please try again.");
    }
  }, [newName, newDescription, createLorebook]);

  const handleDeleteBook = useCallback(() => {
    if (!delBookId) return;
    deleteLorebook.mutate(
      { id: delBookId },
      {
        onSuccess: () => {
          toast.success("Lorebook deleted");
          setDelBookId(null);
          setExpandedId((cur) => (cur === delBookId ? null : cur));
        },
        onError: (err) => {
          console.error("[settings] delete lorebook failed", err);
          toast.error("Couldn't delete this lorebook. Please try again.");
        },
      },
    );
  }, [delBookId, deleteLorebook]);

  const filtered = useMemo(() => {
    const all = lorebooks ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((book) => book.name.toLowerCase().includes(q));
  }, [lorebooks, query]);

  const deleteTarget = lorebooks?.find((book) => book.id === delBookId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Lorebooks"
        description="Enabled books add world details to every chat. Entries are shared across conversations."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-1.5 max-sm:h-11"
              onClick={() => {
                setNewOpen(true);
                setImportOpen(false);
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              New
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-1.5 max-sm:h-11"
              onClick={() => {
                setImportOpen(true);
                setNewOpen(false);
              }}
            >
              <Upload className="size-3.5" aria-hidden="true" />
              Import
            </Button>
          </>
        }
      />

      {lorebooksError ? (
        <ErrorBanner
          message={
            lorebooksError instanceof Error ? lorebooksError.message : "Failed to load lorebooks"
          }
          onRetry={() => void refetchLorebooks()}
        />
      ) : null}

      {lorebooksLoading ? (
        <div role="status" aria-label="Loading lorebooks">
          <SkeletonText lines={3} />
          <span className="sr-only">Loading lorebooks</span>
        </div>
      ) : null}

      {!lorebooksLoading && lorebooks && lorebooks.length > 3 ? (
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-2"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lorebooks"
            aria-label="Search lorebooks"
            className="h-10 pl-9"
          />
        </div>
      ) : null}

      {!lorebooksLoading && lorebooks && lorebooks.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No lorebooks yet"
          description="Lorebooks add characters, places, and rules to every chat."
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" className="h-11 gap-1.5" onClick={() => setImportOpen(true)}>
              <Upload className="size-3.5" aria-hidden="true" />
              Import a lorebook
            </Button>
            <Button variant="ghost" className="h-11 gap-1.5" onClick={() => setNewOpen(true)}>
              <Plus className="size-3.5" aria-hidden="true" />
              Create one
            </Button>
          </div>
        </EmptyState>
      ) : null}

      {!lorebooksLoading && lorebooks && lorebooks.length > 0 ? (
        filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-subtle px-4 py-6 text-center text-[13px] text-2">
            No lorebooks match “{query.trim()}”.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-subtle bg-surface/60">
            <div className="divide-y divide-subtle">
              {filtered.map((lb) => {
                const expanded = expandedId === lb.id;
                const countLabel = `${lb.entryCount} ${lb.entryCount === 1 ? "entry" : "entries"}`;
                return (
                  <div key={lb.id}>
                    <div className="flex min-h-14 items-center gap-1 px-2 py-1 sm:gap-2 sm:px-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : lb.id)}
                        aria-expanded={expanded}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 text-left focus-ring"
                      >
                        {expanded ? (
                          <ChevronDown className="size-4 shrink-0 text-2" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0 text-2" aria-hidden="true" />
                        )}
                        <span
                          className={`truncate text-[13px] font-medium ${lb.enabled ? "text-1" : "text-2"}`}
                        >
                          {lb.name}
                        </span>
                      </button>
                      <span className="hidden shrink-0 text-[11px] tabular-nums text-2 min-[380px]:inline">
                        {countLabel}
                      </span>
                      <div className="flex size-11 shrink-0 items-center justify-center">
                        <Switch
                          checked={lb.enabled}
                          onCheckedChange={(checked) => handleToggle(lb.id, checked)}
                          aria-label={`${lb.enabled ? "Disable" : "Enable"} ${lb.name}`}
                        />
                      </div>
                      <RowActionsMenu
                        label={`Actions for ${lb.name}`}
                        items={[
                          {
                            label: "Delete lorebook",
                            icon: Trash2,
                            destructive: true,
                            onSelect: () => setDelBookId(lb.id),
                          },
                        ]}
                      />
                    </div>
                    {expanded ? <ExpandedEntries lorebookId={lb.id} /> : null}
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : null}

      {newOpen ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-subtle bg-surface/60 p-4">
          <p className="text-[13px] font-medium text-1">New lorebook</p>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Lorebook name"
            aria-label="Lorebook name"
            autoFocus
          />
          <Input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            aria-label="Description"
          />
          {newError ? (
            <p className="text-xs text-danger" role="alert">
              {newError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={createLorebook.isPending} onClick={handleCreateNew}>
              Create
            </Button>
          </div>
        </div>
      ) : null}

      <ImportLorebookDialog open={importOpen} onOpenChange={setImportOpen} />

      <ConfirmDialog
        open={delBookId !== null}
        onOpenChange={(o) => !o && setDelBookId(null)}
        title={`Delete ${deleteTarget?.name ?? "lorebook"}?`}
        description="This permanently deletes the lorebook and all of its entries. This cannot be undone."
        destructive
        loading={deleteLorebook.isPending}
        onConfirm={handleDeleteBook}
      />
    </div>
  );
}

function ExpandedEntries({ lorebookId }: { lorebookId: string }) {
  const { data: entries, isLoading, error, refetch } = useLorebookEntries(lorebookId);
  const toggleEntry = useToggleLoreEntry(lorebookId);
  const deleteEntry = useDeleteLorebookEntry(lorebookId);

  const [dialog, setDialog] = useState<EntryDialog>({ kind: "closed" });
  const [delEntryId, setDelEntryId] = useState<string | null>(null);

  return (
    <div className="ml-3 flex flex-col gap-1 border-l border-subtle py-1 pl-2 pr-2 sm:ml-5">
      {isLoading ? (
        <SkeletonText lines={2} className="py-1" />
      ) : error ? (
        <ErrorBanner
          message={error instanceof Error ? error.message : "Failed to load entries"}
          onRetry={() => void refetch()}
        />
      ) : entries?.length ? (
        entries.map((entry) => (
          <div
            key={entry.id}
            className="flex min-h-12 items-center gap-1 rounded-lg px-2 py-1 hover:bg-(--bg-hover)/50"
          >
            <span className="min-w-0 flex-1 truncate text-xs text-1">
              {entry.data.comment || `Entry #${entry.data.uid}`}
            </span>
            <div className="flex size-11 shrink-0 items-center justify-center">
              <Switch
                checked={!entry.userDisabled && !entry.data.disable}
                disabled={entry.data.disable}
                onCheckedChange={(checked) =>
                  toggleEntry.mutate(
                    { entryId: entry.id, disabled: !checked },
                    {
                      onError: (err) => {
                        console.error("[settings] toggle entry failed", err);
                        toast.error("Couldn't update this entry. Please try again.");
                      },
                    },
                  )
                }
                aria-label={`Toggle ${entry.data.comment || `entry ${entry.data.uid}`}`}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 max-sm:size-11"
              onClick={() => setDialog({ kind: "edit", entry })}
              aria-label={`Edit ${entry.data.comment || `entry ${entry.data.uid}`}`}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 text-2 hover:text-danger max-sm:size-11"
              onClick={() => setDelEntryId(entry.id)}
              aria-label={`Delete ${entry.data.comment || `entry ${entry.data.uid}`}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))
      ) : (
        <p className="px-2 py-2 text-xs text-2">No entries yet.</p>
      )}

      <Button
        variant="outline"
        size="sm"
        className="mt-1 h-10 self-start gap-1.5 max-sm:h-11"
        onClick={() => setDialog({ kind: "create" })}
      >
        <Plus className="size-3.5" aria-hidden="true" />
        New entry
      </Button>

      {dialog.kind === "create" ? (
        <EntryEditorSheet
          lorebookId={lorebookId}
          mode="create"
          onClose={() => setDialog({ kind: "closed" })}
        />
      ) : null}
      {dialog.kind === "edit" ? (
        <EntryEditorSheet
          lorebookId={lorebookId}
          mode="edit"
          entry={dialog.entry}
          onClose={() => setDialog({ kind: "closed" })}
        />
      ) : null}

      <ConfirmDialog
        open={delEntryId !== null}
        onOpenChange={(o) => !o && setDelEntryId(null)}
        title="Delete entry?"
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
              onError: (err) => {
                console.error("[settings] delete entry failed", err);
                toast.error("Couldn't delete this entry. Please try again.");
              },
            },
          );
        }}
      />
    </div>
  );
}
