import { useState, type ChangeEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  useDeleteLorebook,
  useImportLorebook,
  useLorebooks,
  useToggleLorebook,
} from "@/hooks/useLorebooks";

export const Route = createFileRoute("/lorebooks/")({
  component: LorebooksPage,
});

function LorebooksPage() {
  const { data, isLoading, error } = useLorebooks();
  const deleteMutation = useDeleteLorebook();
  const toggleMutation = useToggleLorebook();
  const [importOpen, setImportOpen] = useState(false);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lorebooks</h1>
          <p className="text-muted-foreground text-sm">
            Manage lorebooks and their keyword-triggered entries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            Import
          </Button>
          <Button asChild>
            <Link to="/lorebooks/new">New Lorebook</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : error ? (
        <p className="text-destructive text-sm">Failed to load: {error.message}</p>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              No lorebooks yet. Create one to start adding entries.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((lb) => (
            <Card key={lb.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-1 flex-1">{lb.name}</CardTitle>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-muted-foreground text-xs">
                      {lb.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <Switch
                      checked={lb.enabled}
                      disabled={toggleMutation.isPending}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ lorebookId: lb.id, enabled: checked })
                      }
                      aria-label={`Toggle ${lb.name}`}
                    />
                  </div>
                </div>
                {lb.description ? (
                  <CardDescription className="line-clamp-2">{lb.description}</CardDescription>
                ) : null}
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="secondary">
                    {lb.entryCount} {lb.entryCount === 1 ? "entry" : "entries"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex justify-between gap-2">
                <Button asChild size="sm">
                  <Link to="/lorebooks/$id" params={{ id: lb.id }}>
                    Open
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete lorebook "${lb.name}"? This removes all entries.`)) {
                      deleteMutation.mutate({ id: lb.id });
                    }
                  }}
                >
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ImportLorebookDialog open={importOpen} onOpenChange={setImportOpen} />
    </main>
  );
}

function ImportLorebookDialog({
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
        parts.push(`${result.entriesInserted} ${result.entriesInserted === 1 ? "entry" : "entries"}`);
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
            Upload a SillyTavern world-info JSON file. The lorebook is created
            disabled — toggle it on from the list to activate.
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
