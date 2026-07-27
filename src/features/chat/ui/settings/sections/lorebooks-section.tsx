import { useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Upload, ArrowRight } from "lucide-react";
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
import {
  useLorebooks,
  useToggleLorebook,
  useLorebookEntries,
  useToggleLoreEntry,
} from "@/hooks/useLorebooks";
import { ImportLorebookDialog } from "@/components/lorebook/ImportLorebookDialog";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
  isAdmin: boolean;
}

export function LorebooksSection(_props: SectionProps) {
  const { data: lorebooks } = useLorebooks();
  const toggleLorebook = useToggleLorebook();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [addBookId, setAddBookId] = useState("");

  const handleToggle = useCallback(
    (lorebookId: string, enabled: boolean) => {
      toggleLorebook.mutate({ lorebookId, enabled });
    },
    [toggleLorebook],
  );

  const available = lorebooks?.filter((lb) => !lb.enabled) ?? [];
  const enabled = lorebooks?.filter((lb) => lb.enabled) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-heading text-[--sea-ink]">Lorebooks</p>
        <Button
          variant="link"
          size="sm"
          className="h-auto gap-1 p-0 text-[11px] text-[--lagoon]"
          asChild
        >
          <Link to="/lorebooks">
            Manage lorebooks
            <ArrowRight className="size-3" />
          </Link>
        </Button>
      </div>

      {enabled.length > 0 && (
        <div className="flex flex-col gap-1">
          {enabled.map((lb) => (
            <div key={lb.id}>
              <div className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === lb.id ? null : lb.id)}
                  className="flex items-center gap-1.5 text-xs text-[--sea-ink-soft] hover:text-[--sea-ink]"
                >
                  {expandedId === lb.id ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                  <span>{lb.name}</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tabular-nums text-white/30">{lb.entryCount}</span>
                  <Switch
                    checked
                    onCheckedChange={() => handleToggle(lb.id, false)}
                    aria-label={`Disable ${lb.name}`}
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

      <div className="flex items-center gap-2">
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
        <Button
          variant="outline"
          size="sm"
          className="mt-5 gap-1.5"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="size-3.5" />
          Import
        </Button>
      </div>

      <ImportLorebookDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function ExpandedEntries({ lorebookId }: { lorebookId: string }) {
  const { data: entries } = useLorebookEntries(lorebookId);
  const toggleEntry = useToggleLoreEntry(lorebookId);

  if (!entries?.length) {
    return <p className="ml-5 py-1 text-[11px] text-white/20">No entries</p>;
  }

  return (
    <div className="ml-5 flex flex-col">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between rounded px-2 py-1 hover:bg-white/5"
        >
          <span className="text-[11px] text-[--sea-ink-soft] truncate max-w-[70%]">
            {entry.data.comment || `Entry #${entry.data.uid}`}
          </span>
          <Switch
            checked={!entry.userDisabled && !entry.data.disable}
            disabled={entry.data.disable}
            onCheckedChange={(checked) =>
              toggleEntry.mutate({ entryId: entry.id, disabled: !checked })
            }
            aria-label={`Toggle ${entry.data.comment || `entry ${entry.data.uid}`}`}
          />
        </div>
      ))}
    </div>
  );
}
