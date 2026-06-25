import { useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useImportLorebook } from "@/hooks/useLorebooks";

export function ImportLorebookDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importMutation = useImportLorebook();

  const handleClose = () => {
    if (importMutation.isPending) return;
    setFile(null);
    setError(null);
    onOpenChange(false);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null;
    setFile(next);
    setError(null);
  };

  const handleImport = async () => {
    if (!file) {
      setError("Please choose a JSON file.");
      return;
    }
    setError(null);
    let content: string;
    try {
      content = await file.text();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
      return;
    }
    try {
      const result = await importMutation.mutateAsync({ content });
      const parts: string[] = [];
      parts.push(`Imported "${result.name}"`);
      if (result.entriesInserted > 0) {
        parts.push(
          `${result.entriesInserted} ${result.entriesInserted === 1 ? "entry" : "entries"}`,
        );
      }
      if (result.entriesSkipped > 0) {
        parts.push(`${result.entriesSkipped} skipped`);
      }
      toast.success(parts.join(" · "));
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import lorebook");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Lorebook</DialogTitle>
          <DialogDescription>
            Upload a SillyTavern world-info JSON file. The lorebook is created disabled — toggle it
            on from the list to activate.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label htmlFor="lorebook-json" className="block text-sm font-medium">
            World file (JSON)
          </label>
          <input
            id="lorebook-json"
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            disabled={importMutation.isPending}
            className="border-input bg-background text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-secondary/80 block w-full rounded-md border px-3 py-2"
          />
          {file ? (
            <p className="text-muted-foreground text-xs">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </p>
          ) : null}
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={importMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || importMutation.isPending}>
            {importMutation.isPending ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
