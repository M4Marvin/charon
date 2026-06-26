import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CharacterCard } from "@/components/character/CharacterCard";
import { useCharacters, useDeleteCharacter } from "@/hooks/useCharacters";
import type { CharacterListItem } from "@/server/fns/characters";

export const Route = createFileRoute("/characters/")({
  component: CharactersPage,
});

type SortKey =
  | "updatedAt-desc"
  | "updatedAt-asc"
  | "name-asc"
  | "name-desc"
  | "chats-desc"
  | "chats-asc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updatedAt-desc", label: "Recently updated" },
  { value: "updatedAt-asc", label: "Oldest updated" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "chats-desc", label: "Most chats" },
  { value: "chats-asc", label: "Fewest chats" },
];

function sortCharacters(items: CharacterListItem[], key: SortKey): CharacterListItem[] {
  const sorted = [...items];
  switch (key) {
    case "updatedAt-desc":
      return sorted.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    case "updatedAt-asc":
      return sorted.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "chats-desc":
      return sorted.sort((a, b) => b.chatCount - a.chatCount);
    case "chats-asc":
      return sorted.sort((a, b) => a.chatCount - b.chatCount);
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
  const { data, isLoading, error } = useCharacters();
  const deleteMutation = useDeleteCharacter();

  const [search, setSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt-desc");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const allTags = useMemo(() => {
    if (!data) return [];
    const tagSet = new Set<string>();
    for (const c of data) {
      for (const t of c.tags) {
        if (t) tagSet.add(t);
      }
    }
    return [...tagSet].sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredTags = useMemo(() => {
    if (!tagSearch.trim()) return allTags;
    const q = tagSearch.toLowerCase().trim();
    return allTags.filter((t) => t.toLowerCase().includes(q));
  }, [allTags, tagSearch]);

  const filtered = useMemo(
    () => (data ? filterCharacters(data, search, activeTags) : []),
    [data, search, activeTags],
  );

  const sorted = useMemo(() => sortCharacters(filtered, sortKey), [filtered, sortKey]);

  function toggleTag(tag: string) {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function addTag(tag: string) {
    setActiveTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Characters</h1>
          <p className="text-muted-foreground text-sm">Import and manage your character cards.</p>
        </div>
        <Button asChild>
          <Link to="/characters/new">Import PNG</Link>
        </Button>
      </div>

      {!isLoading && !error && data && data.length > 0 ? (
        <>
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search name, creator notes, creator..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="size-4 text-muted-foreground" />
                <select
                  className="border border-input rounded-md bg-background px-2 py-1.5 text-sm"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {allTags.length > 0 ? (
              <div className="flex items-center gap-2 min-w-0">
                {/* Selected tags on the left */}
                {activeTags.length > 0 ? (
                  <div className="flex items-center gap-1 shrink-0">
                    {activeTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="default"
                        className="cursor-pointer text-xs shrink-0"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                        <X className="ml-0.5 size-3" />
                      </Badge>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs shrink-0"
                      onClick={() => setActiveTags([])}
                    >
                      Clear
                    </Button>
                  </div>
                ) : null}

                {/* Scrollable available tags row */}
                <div
                  className="flex-1 overflow-x-auto flex items-center gap-1 min-w-0"
                  style={{ scrollbarWidth: "none" }}
                >
                  {filteredTags.map((tag) => {
                    const isActive = activeTags.includes(tag);
                    return (
                      <Badge
                        key={tag}
                        variant={isActive ? "default" : "secondary"}
                        className="cursor-pointer text-xs shrink-0"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Badge>
                    );
                  })}
                </div>

                {/* Tag search input on the right */}
                <div className="relative w-36 shrink-0">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                  <Input
                    className="pl-6 h-7 text-xs"
                    placeholder="Filter tags..."
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {sorted.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground text-sm">No characters match your filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 items-start">
              {sorted.map((char) => (
                <CharacterCard
                  key={char.id}
                  character={char}
                  isDeleting={deleteMutation.isPending}
                  onTagClick={addTag}
                  onDelete={(id, name) => {
                    if (window.confirm(`Delete character "${name}"?`)) {
                      deleteMutation.mutate({ id });
                    }
                  }}
                />
              ))}
            </div>
          )}
        </>
      ) : isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : error ? (
        <p className="text-destructive text-sm">Failed to load: {error.message}</p>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              No characters yet. Import a PNG character card to get started.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
