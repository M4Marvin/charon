import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Upload, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Field, FieldLabel } from "@/components/ui/field";
import { SectionHeader } from "../section-header";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
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

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
  isAdmin: boolean;
}

type EntryDialog =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; entry: LoreEntryListItem };

export function LorebooksSection(_props: SectionProps) {
  const { data: lorebooks } = useLorebooks();
  const toggleLorebook = useToggleLorebook();
  const createLorebook = useCreateLorebook();
  const deleteLorebook = useDeleteLorebook();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newError, setNewError] = useState<string | null>(null);
  const [addBookId, setAddBookId] = useState("");
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
        description: newDescription.trim() || undefined,
      });
      toast.success("Lorebook created");
      setNewName("");
      setNewDescription("");
      setNewOpen(false);
      setExpandedId(result.id);
    } catch (err) {
      setNewError(err instanceof Error ? err.message : "Failed to create lorebook");
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
        onError: (err) =>
          toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`),
      },
    );
  }, [delBookId, deleteLorebook]);

  const available = lorebooks?.filter((lb) => !lb.enabled) ?? [];
  const enabled = lorebooks?.filter((lb) => lb.enabled) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Lorebooks"
        description="Toggle active books, manage entries."
        actions={
          <>
            <Button
              variant="link"
              size="sm"
              className="h-auto gap-1 p-0 text-[11px] text-[--lagoon]"
              onClick={() => {
                setNewOpen(true);
                setImportOpen(false);
              }}
            >
              <Plus className="size-3" data-icon="inline-start" />
              New
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto gap-1 p-0 text-[11px] text-[--lagoon]"
              onClick={() => {
                setImportOpen(true);
                setNewOpen(false);
              }}
            >
              <Upload className="size-3" data-icon="inline-start" />
              Import
            </Button>
          </>
        }
      />

      {enabled.length > 0 && (
        <div className="flex flex-col gap-1">
          {enabled.map((lb) => (
            <div key={lb.id}>
              <div className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === lb.id ? null : lb.id)}
                  className="flex items-center gap-1.5 text-xs text-[--sea-ink-soft] hover:text-[--sea-ink] min-w-0"
                >
                  {expandedId === lb.id ? (
                    <ChevronDown className="size-3.5 shrink-0" />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0" />
                  )}
                  <span className="truncate">{lb.name}</span>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] tabular-nums text-white/30">{lb.entryCount}</span>
                  <Switch
                    checked
                    onCheckedChange={() => handleToggle(lb.id, false)}
                    aria-label={`Disable ${lb.name}`}
                  />
                  <RowActionsMenu
                    label={`Actions for ${lb.name}`}
                    items={[
                      {
                        label: "Delete lorebook",
                        destructive: true,
                        onSelect: () => setDelBookId(lb.id),
                      },
                    ]}
                  />
                </div>
              </div>
              {expandedId === lb.id && <ExpandedEntries lorebookId={lb.id} />}
            </div>
          ))}
        </div>
      )}

      {enabled.length === 0 && (
        <p className="text-xs text-[--sea-ink-soft]">No lorebooks enabled.</p>
      )}

      <div className="flex items-end gap-2">
        <Field className="flex-1 space-y-1.5">
          <FieldLabel htmlFor="ls-add">Add lorebook</FieldLabel>
          <Select
            value={addBookId}
            onValueChange={(id) => {
              handleToggle(id, true);
              setAddBookId("");
            }}
            disabled={available.length === 0}
          >
            <SelectTrigger id="ls-add">
              <SelectValue
                placeholder={available.length === 0 ? "All books enabled" : "Select lorebook"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {available.map((lb) => (
                  <SelectItem key={lb.id} value={lb.id}>
                    {lb.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {newOpen && (
        <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
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
          {newError ? <p className="text-xs text-red-400">{newError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={createLorebook.isPending} onClick={handleCreateNew}>
              Create
            </Button>
          </div>
        </div>
      )}

      <ImportLorebookDialog open={importOpen} onOpenChange={setImportOpen} />

      <ConfirmDialog
        open={delBookId !== null}
        onOpenChange={(o) => !o && setDelBookId(null)}
        title="Delete lorebook"
        description="This will permanently delete this lorebook and all its entries. This action cannot be undone."
        destructive
        loading={deleteLorebook.isPending}
        onConfirm={handleDeleteBook}
      />
    </div>
  );
}

function ExpandedEntries({ lorebookId }: { lorebookId: string }) {
  const { data: entries } = useLorebookEntries(lorebookId);
  const toggleEntry = useToggleLoreEntry(lorebookId);
  const deleteEntry = useDeleteLorebookEntry(lorebookId);

  const [dialog, setDialog] = useState<EntryDialog>({ kind: "closed" });
  const [delEntryId, setDelEntryId] = useState<string | null>(null);

  return (
    <div className="ml-5 flex flex-col gap-1 border-l border-white/5 pl-2">
      {entries?.length ? (
        entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between gap-1 rounded px-2 py-1 hover:bg-white/5"
          >
            <span className="text-[11px] text-[--sea-ink-soft] truncate max-w-[45%]">
              {entry.data.comment || `Entry #${entry.data.uid}`}
            </span>
            <div className="flex items-center gap-0.5 shrink-0">
              <Switch
                checked={!entry.userDisabled && !entry.data.disable}
                disabled={entry.data.disable}
                onCheckedChange={(checked) =>
                  toggleEntry.mutate({ entryId: entry.id, disabled: !checked })
                }
                aria-label={`Toggle ${entry.data.comment || `entry ${entry.data.uid}`}`}
              />
              <button
                type="button"
                onClick={() => setDialog({ kind: "edit", entry })}
                className="size-6 flex items-center justify-center rounded text-[--sea-ink-soft] hover:text-[--sea-ink] hover:bg-white/5"
                aria-label={`Edit ${entry.data.comment || `entry ${entry.data.uid}`}`}
              >
                <Pencil className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => setDelEntryId(entry.id)}
                className="size-6 flex items-center justify-center rounded text-[--sea-ink-soft] hover:text-red-400 hover:bg-white/5"
                aria-label={`Delete ${entry.data.comment || `entry ${entry.data.uid}`}`}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>
        ))
      ) : (
        <p className="py-1 text-[11px] text-white/20">No entries</p>
      )}

      <Button
        variant="outline"
        size="sm"
        className="self-start gap-1"
        onClick={() => setDialog({ kind: "create" })}
      >
        <Plus className="size-3" data-icon="inline-start" />
        New Entry
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
    </div>
  );
}
