import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCharacter, useDeleteCharacter, useUpdateCharacter } from "@/hooks/useCharacters";
import type { Character } from "@/db/schema";
import type { CharacterDataV2 } from "@/lib/st-core/character";

export const Route = createFileRoute("/characters/$id")({
  component: CharacterDetailPage,
});

function CharacterDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: character, isLoading, error } = useCharacter(id);
  const deleteMutation = useDeleteCharacter();
  const [renameOpen, setRenameOpen] = useState(false);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link to="/characters">← Back</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : error ? (
            <p className="text-destructive text-sm">Failed to load: {error.message}</p>
          ) : character ? (
            <CharacterSidebar
              character={character}
              onRename={() => setRenameOpen(true)}
              onDelete={() => {
                if (window.confirm(`Delete character "${character.name}"?`)) {
                  deleteMutation.mutate(
                    { id: character.id },
                    {
                      onSuccess: () => void navigate({ to: "/characters" }),
                    },
                  );
                }
              }}
              deletePending={deleteMutation.isPending}
            />
          ) : null}
        </aside>

        <div className="space-y-4">
          {character ? <CharacterFields character={character} /> : null}
        </div>
      </div>

      {character ? (
        <RenameDialog
          character={character}
          open={renameOpen}
          onClose={() => setRenameOpen(false)}
        />
      ) : null}
    </main>
  );
}

function CharacterSidebar({
  character,
  onRename,
  onDelete,
  deletePending,
}: {
  character: Character;
  onRename: () => void;
  onDelete: () => void;
  deletePending: boolean;
}) {
  const data = character.data;
  const hasAvatar = Boolean(character.imagePath);

  return (
    <div className="space-y-4">
      {hasAvatar ? (
        <img
          src={`/api/characters/${character.id}/avatar`}
          alt={character.name}
          className="aspect-square w-full rounded-lg object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div className="bg-muted aspect-square w-full rounded-lg" />
      )}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{character.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{character.spec}</Badge>
          <Badge variant="outline">v{character.specVersion}</Badge>
          {data.character_version ? (
            <Badge variant="outline">card {data.character_version}</Badge>
          ) : null}
          {data.creator ? <Badge variant="outline">by {data.creator}</Badge> : null}
        </div>
        {data.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {data.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
        {data.extensions.world ? (
          <p className="text-muted-foreground mt-3 text-xs">
            World: <span className="text-foreground">{data.extensions.world}</span>
          </p>
        ) : null}
        {data.extensions.talkativeness !== undefined ? (
          <p className="text-muted-foreground text-xs">
            Talkativeness:{" "}
            <span className="text-foreground">{data.extensions.talkativeness}</span>
          </p>
        ) : null}
      </div>

      <div className="text-muted-foreground space-y-0.5 text-xs">
        <p>
          Created: <span className="text-foreground">{formatDate(character.createdAt)}</span>
        </p>
        <p>
          Updated: <span className="text-foreground">{formatDate(character.updatedAt)}</span>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={onRename} variant="outline" size="sm">
          Rename
        </Button>
        <Button onClick={onDelete} variant="destructive" size="sm" disabled={deletePending}>
          {deletePending ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </div>
  );
}

function CharacterFields({ character }: { character: Character }) {
  const data = character.data;

  return (
    <>
      <TextFieldCard title="Description" content={data.description} />
      <TextFieldCard title="Personality" content={data.personality} />
      <TextFieldCard title="Scenario" content={data.scenario} />
      <TextFieldCard title="First Message" content={data.first_mes} />

      {data.alternate_greetings.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Alternate Greetings</CardTitle>
            <CardDescription>
              {data.alternate_greetings.length} alternative opener
              {data.alternate_greetings.length === 1 ? "" : "s"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.alternate_greetings.map((greeting, i) => (
              <div
                key={i}
                className="bg-muted/40 rounded-md border p-3 text-sm whitespace-pre-wrap"
              >
                <p className="text-muted-foreground mb-1 text-xs">#{i + 1}</p>
                {greeting}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <TextFieldCard title="Example Messages" content={data.mes_example} />
      <TextFieldCard title="Creator Notes" content={data.creator_notes} />
      <TextFieldCard title="System Prompt" content={data.system_prompt} />
      <TextFieldCard
        title="Post-History Instructions"
        content={data.post_history_instructions}
      />

      {data.extensions.depth_prompt ? (
        <Card>
          <CardHeader>
            <CardTitle>Depth Prompt</CardTitle>
            <CardDescription>
              role: {data.extensions.depth_prompt.role} · depth:{" "}
              {data.extensions.depth_prompt.depth}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap">
              {data.extensions.depth_prompt.prompt}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      {data.character_book ? <EmbeddedLorebookCard book={data.character_book} /> : null}
    </>
  );
}

function TextFieldCard({ title, content }: { title: string; content: string }) {
  if (!content) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </CardContent>
    </Card>
  );
}

function EmbeddedLorebookCard({ book }: { book: NonNullable<CharacterDataV2["character_book"]> }) {
  const entries = book.entries ?? [];

  return (
    <Card>
      <Collapsible>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="hover:bg-muted/40 -mx-2 flex w-[calc(100%+1rem)] items-center justify-between rounded-md px-2 py-1 text-left transition-colors"
            >
              <div>
                <CardTitle>{book.name || "Embedded Lorebook"}</CardTitle>
                {book.description ? (
                  <CardDescription className="line-clamp-1">{book.description}</CardDescription>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {entries.length} {entries.length === 1 ? "entry" : "entries"}
                </Badge>
                {book.scan_depth !== undefined ? (
                  <Badge variant="outline">scan {book.scan_depth}</Badge>
                ) : null}
                {book.recursive_scanning ? <Badge variant="outline">recursive</Badge> : null}
                <span className="text-muted-foreground text-xs">▾</span>
              </div>
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-muted-foreground text-sm">No entries in this embedded book.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comment</TableHead>
                    <TableHead>Keys</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead className="w-20">Pos</TableHead>
                    <TableHead className="w-16">On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, i) => (
                    <TableRow key={entry.id ?? i}>
                      <TableCell className="line-clamp-1 max-w-xs">
                        {entry.comment || entry.name || (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.keys.join(", ") || (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground line-clamp-2 max-w-md text-xs">
                        {entry.content}
                      </TableCell>
                      <TableCell className="text-xs">{entry.position ?? "—"}</TableCell>
                      <TableCell>
                        {entry.enabled === false ? (
                          <Badge variant="outline">off</Badge>
                        ) : (
                          <Badge>on</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function RenameDialog({
  character,
  open,
  onClose,
}: {
  character: Character;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(character.name);
  const [error, setError] = useState<string | null>(null);
  const updateMutation = useUpdateCharacter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name cannot be empty.");
      return;
    }
    if (trimmed === character.name) {
      onClose();
      return;
    }
    setError(null);
    try {
      await updateMutation.mutateAsync({ id: character.id, name: trimmed });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Character</DialogTitle>
          <DialogDescription>
            Renames the character record. The card data inside is unchanged.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename">Name</Label>
            <Input
              id="rename"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              disabled={updateMutation.isPending}
              autoFocus
              required
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
