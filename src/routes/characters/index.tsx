import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { Search, UserRoundCog, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { SkeletonCardGrid } from "@/components/common/Skeletons";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { TagFilterPopover } from "@/components/common/TagFilterPopover";
import { useCharacters, useDeleteCharacter } from "@/hooks/useCharacters";
import { authClient } from "@/lib/auth-client";
import type { CharacterListItem } from "@/server/fns/characters";

export const Route = createFileRoute("/characters/")({
  component: CharactersPage,
});

type SortKey = "updatedAt-desc" | "name-asc" | "chats-desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updatedAt-desc", label: "Recently updated" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "chats-desc", label: "Most chats" },
];

function sortCharacters(items: CharacterListItem[], key: SortKey): CharacterListItem[] {
  const sorted = [...items];
  switch (key) {
    case "updatedAt-desc":
      return sorted.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "chats-desc":
      return sorted.sort((a, b) => b.chatCount - a.chatCount);
  }
}

function filterCharacters(
  items: CharacterListItem[],
  q: string,
  tags: string[],
): CharacterListItem[] {
  let result = items;
  if (q.trim()) {
    const query = q.toLowerCase().trim();
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.creatorNotes.toLowerCase().includes(query) ||
        c.creator.toLowerCase().includes(query),
    );
  }
  if (tags.length > 0) {
    result = result.filter((c) => tags.every((t) => c.tags.includes(t)));
  }
  return result;
}

function CharactersPage() {
  const { data: session } = authClient.useSession();
  const isDemo = session?.user?.role !== "admin";
  const { data, isLoading, error } = useCharacters();
  const deleteMutation = useDeleteCharacter();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt-desc");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const tagCounts = useMemo(() => {
    if (!data) return [] as { name: string; count: number }[];
    const counts = new Map<string, number>();
    for (const c of data) {
      for (const t of c.tags) {
        if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const filtered = useMemo(
    () => (data ? filterCharacters(data, search, activeTags) : []),
    [data, search, activeTags],
  );

  const sorted = useMemo(() => sortCharacters(filtered, sortKey), [filtered, sortKey]);

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <PageHeader
        title="Characters"
        subtitle="Import and manage your character cards."
        actions={
          !isDemo ? (
            <Button asChild>
              <Link to="/characters/new">Import PNG</Link>
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <SkeletonCardGrid count={6} />
      ) : error ? (
        <ErrorBanner message={(error as Error).message ?? "Failed to load characters"} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={UserRoundCog}
          title="No characters yet"
          description="Import a PNG character card to get started."
        >
          {!isDemo ? (
            <Button asChild>
              <Link to="/characters/new">Import PNG</Link>
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <>
          {/* Toolbar */}
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search name, creator, notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {tagCounts.length > 0 ? (
                <TagFilterPopover tags={tagCounts} selected={activeTags} onChange={setActiveTags} />
              ) : null}
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="w-auto min-w-[140px] gap-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeTags.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                {activeTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer gap-1 pr-1 text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setActiveTags(activeTags.filter((t) => t !== tag))}
                      className="ml-0.5 inline-flex size-3.5 items-center justify-center rounded-sm hover:bg-muted-foreground/20"
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setActiveTags([])}
                >
                  Clear
                </Button>
              </div>
            ) : null}
          </div>

          {sorted.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-2 text-sm">No characters match your filters.</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setActiveTags([]);
                }}
                className="mt-1"
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-start">
              {sorted.map((char) => (
                <CharacterCard
                  key={char.id}
                  character={char}
                  isDemo={isDemo}
                  isDeleting={deleteMutation.isPending}
                  onDelete={() => setDeletingId(char.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title="Delete character"
        description="This will permanently delete the character and all associated chats and messages. This action cannot be undone."
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!deletingId) return;
          deleteMutation.mutate(
            { id: deletingId },
            {
              onSuccess: () => {
                toast.success("Character deleted");
                setDeletingId(null);
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

function CharacterCard({
  character,
  isDemo,
  onDelete,
}: {
  character: CharacterListItem;
  isDemo: boolean;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="group relative rounded-xl border bg-card overflow-hidden transition-shadow hover:shadow-lg">
      <Link
        to="/characters/$id"
        params={{ id: character.id }}
        className="block focus-ring rounded-xl"
      >
        {/* Image */}
        <div className="aspect-[3/4] bg-muted relative overflow-hidden">
          {character.imagePath ? (
            <img
              src={`/api/characters/${character.id}/avatar`}
              alt={character.name}
              className="size-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-raised">
              <span className="text-3 text-4xl font-heading">{character.name.charAt(0)}</span>
            </div>
          )}
        </div>
        {/* Body */}
        <div className="p-3">
          <h3 className="text-headline truncate">{character.name}</h3>
          {character.creatorNotes ? (
            <p className="text-2 text-sm line-clamp-2 mt-0.5">{character.creatorNotes}</p>
          ) : null}
          <div className="flex items-center gap-1.5 mt-2">
            {character.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 leading-tight"
              >
                {tag}
              </Badge>
            ))}
            {character.tags.length > 3 ? (
              <span className="text-3 text-[10px]">+{character.tags.length - 3}</span>
            ) : null}
          </div>
        </div>
      </Link>

      {!isDemo ? (
        <div className="absolute top-2 right-2">
          <RowActionsMenu
            label={`Actions for ${character.name}`}
            items={[
              {
                label: "Edit",
                onSelect: () =>
                  void navigate({ to: "/characters/$id/edit", params: { id: character.id } }),
              },
              {
                label: "Delete",
                destructive: true,
                onSelect: onDelete,
              },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
