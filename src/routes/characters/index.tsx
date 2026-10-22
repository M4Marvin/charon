import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { type } from "arktype";
import { LoaderCircle, MessagesSquare, Plus, Search, UserRoundCog, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptimizedImage } from "@/components/ui/optimized-image";
import {
  Select,
  SelectContent,
  SelectGroup,
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
import {
  useCharacterSearch,
  useCharacterTagCounts,
  useDeleteCharacter,
} from "@/hooks/useCharacters";
import { RelativeTime } from "@/components/common/RelativeTime";
import type { CharacterListItem } from "@/server/fns/characters";
import { withImageVersion } from "@/lib/image-optimization";
import { plainExcerpt } from "@/lib/plain-text";
import { cn } from "@/lib/utils";
import { friendlyLoadError } from "@/lib/error-copy";

const searchSchema = type({
  "q?": "string",
  "tags?": "string",
  sort: '"updatedAt-desc" | "name-asc" | "chats-desc" = "updatedAt-desc"',
});

export const Route = createFileRoute("/characters/")({
  validateSearch: searchSchema,
  component: CharactersPage,
});

type SortKey = "updatedAt-desc" | "name-asc" | "chats-desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updatedAt-desc", label: "Recently updated" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "chats-desc", label: "Most chats" },
];

/** Fixed card body so every lane aligns: title, excerpt, creator, tags, meta. */
const CARD_BODY_HEIGHT = 132;
const GAP = 12;

function getLaneCount(vw: number): number {
  const cw = Math.min(vw - 32, 1200);
  if (cw >= 1100) return 5;
  if (cw >= 860) return 4;
  if (cw >= 600) return 3;
  return 2;
}

function getCardMetrics(lanes: number, vw: number) {
  const contentWidth = Math.min(vw - 32, 1200);
  // Every lane reserves the same gutter; the list container is widened by one
  // gutter so the last column still ends flush with the page.
  const itemWidth = (contentWidth + GAP) / lanes;
  const cardWidth = itemWidth - GAP;
  const cardHeight = Math.ceil(cardWidth * (4 / 3) + CARD_BODY_HEIGHT);
  return { contentWidth, cardWidth, cardHeight };
}

function CharactersPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const searchParams = Route.useSearch();
  const deleteMutation = useDeleteCharacter();

  const [searchInput, setSearchInput] = useState(searchParams.q ?? "");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(1280);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);

  const q = searchParams.q;
  const tags = searchParams.tags ? searchParams.tags.split(",").filter(Boolean) : [];
  const sort = searchParams.sort;

  const {
    data: searchData,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useCharacterSearch({ q, tags, sort });

  const { data: tagCounts } = useCharacterTagCounts();

  useEffect(() => {
    setSearchInput(searchParams.q ?? "");
  }, [searchParams.q]);

  const updateSearch = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        navigate({ search: (prev) => ({ ...prev, q: value || undefined }), replace: true });
      }, 250);
    },
    [navigate],
  );

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const updateTags = useCallback(
    (newTags: string[]) => {
      navigate({
        search: (prev) => ({ ...prev, tags: newTags.length > 0 ? newTags.join(",") : undefined }),
        replace: true,
      });
    },
    [navigate],
  );

  const updateSort = useCallback(
    (newSort: SortKey) => {
      navigate({ search: (prev) => ({ ...prev, sort: newSort }), replace: true });
    },
    [navigate],
  );

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable)
          return;
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === searchRef.current) {
        if (searchInput) {
          setSearchInput("");
          updateSearch("");
        } else {
          (e.target as HTMLElement).blur();
        }
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [searchInput, updateSearch]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setViewportWidth(window.innerWidth);
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const lanes = getLaneCount(viewportWidth);
  const { contentWidth, cardHeight } = getCardMetrics(lanes, viewportWidth);
  const lanePct = 100 / lanes;

  const items = useMemo(() => searchData?.pages.flatMap((p) => p.items) ?? [], [searchData]);
  const total = searchData?.pages[0]?.total ?? 0;

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    lanes,
    gap: GAP,
    estimateSize: () => cardHeight,
    overscan: 4,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastVirtualIndex =
    virtualItems.length > 0 ? virtualItems[virtualItems.length - 1]!.index : -1;
  const shouldFetch = lastVirtualIndex >= items.length - lanes * 2;

  useEffect(() => {
    if (shouldFetch && hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [shouldFetch, hasNextPage, isFetching, fetchNextPage]);

  const isInitialLoading = isLoading && !searchData;
  const hasFilters = Boolean(q) || tags.length > 0;
  const isEmpty = !isLoading && !error && total === 0 && !hasFilters;
  const isNoMatches = !isLoading && !error && total === 0 && hasFilters;
  const isRefiltering = isFetching && !isFetchingNextPage && Boolean(searchData);
  const deletingCharacter = items.find((character) => character.id === deletingId) ?? null;

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 pb-24">
      <PageHeader
        title="Characters"
        subtitle={
          isInitialLoading
            ? "Loading your library…"
            : total > 0
              ? `${total.toLocaleString()} character${total !== 1 ? "s" : ""}`
              : "Import and manage your character cards."
        }
        actions={
          <Button asChild className="gap-1.5">
            <Link to="/characters/new">
              <Plus className="size-4" data-icon="inline-start" aria-hidden="true" />
              Import PNG
            </Link>
          </Button>
        }
      />

      {error ? (
        <div className="mb-6">
          <ErrorBanner
            message={friendlyLoadError(error, "We couldn’t load your characters.")}
            onRetry={() => void refetch()}
          />
        </div>
      ) : null}

      {isInitialLoading ? (
        <SkeletonCardGrid count={10} lanes={lanes} aspect="aspect-[3/4]" />
      ) : isEmpty ? (
        <EmptyState
          icon={UserRoundCog}
          title="No characters yet"
          description="Import a PNG character card to get started."
        >
          <Button asChild>
            <Link to="/characters/new">Import PNG</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="sticky top-14 z-20 -mx-4 space-y-3 bg-(--bg-base)/95 px-4 py-3 backdrop-blur-sm">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                ref={searchRef}
                className="h-10 pl-9 pr-12"
                placeholder="Search characters…"
                aria-label="Search characters"
                value={searchInput}
                onChange={(e) => updateSearch(e.target.value)}
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-2 sm:inline-flex">
                /
              </kbd>
            </div>

            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
              {tagCounts && tagCounts.length > 0 ? (
                <TagFilterPopover tags={tagCounts} selected={tags} onChange={updateTags} />
              ) : null}
              <Select value={sort} onValueChange={(v) => updateSort(v as SortKey)}>
                <SelectTrigger
                  className="h-10 w-auto min-w-[140px] shrink-0 gap-1.5"
                  aria-label="Sort characters"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="shrink-0 cursor-pointer gap-1 pr-1 text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => updateTags(tags.filter((t) => t !== tag))}
                    className="inline-flex size-7 items-center justify-center rounded-md hover:bg-muted-foreground/20"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </Badge>
              ))}
              {tags.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 shrink-0 text-xs"
                  onClick={() => updateTags([])}
                >
                  Clear all
                </Button>
              ) : null}
            </div>
          </div>

          <p role="status" aria-live="polite" className="py-3 text-xs text-2 tabular-nums">
            {isRefiltering
              ? `Searching ${total.toLocaleString()} character${total !== 1 ? "s" : ""}…`
              : `${total.toLocaleString()} character${total !== 1 ? "s" : ""}`}
          </p>

          {isNoMatches ? (
            <EmptyState
              icon={Search}
              title="Nothing matches your search"
              description="Try adjusting your search or filters."
            >
              <Button
                variant="outline"
                onClick={() => {
                  setSearchInput("");
                  navigate({ search: (_prev) => ({}), replace: true });
                }}
              >
                Clear filters
              </Button>
            </EmptyState>
          ) : (
            <div
              className={isRefiltering ? "opacity-60 transition-opacity duration-150" : ""}
              role="list"
              style={{
                width: contentWidth + GAP,
                height: virtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {virtualItems.map((item) => {
                const character = items[item.index];
                if (!character) return null;
                return (
                  <div
                    key={character.id}
                    role="listitem"
                    style={{
                      position: "absolute",
                      top: item.start,
                      left: `${(item.lane / lanes) * 100}%`,
                      width: `${lanePct}%`,
                      paddingRight: GAP,
                      boxSizing: "border-box",
                    }}
                  >
                    <CharacterCard
                      character={character}
                      cardHeight={cardHeight}
                      onDelete={() => setDeletingId(character.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {isFetchingNextPage ? (
            <div
              role="status"
              className="flex items-center justify-center gap-2 py-6 text-xs text-2"
            >
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              Loading more characters…
            </div>
          ) : !hasNextPage && items.length > 0 ? (
            <p className="py-6 text-center text-xs text-2">
              All {total.toLocaleString()} character{total !== 1 ? "s" : ""} shown
            </p>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title={deletingCharacter ? `Delete “${deletingCharacter.name}”?` : "Delete this character?"}
        description="This permanently deletes the character and every chat and message attached to it. This cannot be undone."
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
                toast.error(
                  `Couldn’t delete this character: ${err instanceof Error ? err.message : String(err)}`,
                ),
            },
          );
        }}
      />
    </main>
  );
}

function CharacterCard({
  character,
  cardHeight,
  onDelete,
}: {
  character: CharacterListItem;
  cardHeight: number;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const avatarUrl = character.imagePath
    ? withImageVersion(`/api/characters/${character.id}/avatar`, character.imagePath)
    : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = avatarUrl !== null && failedSrc !== avatarUrl;
  const excerpt = plainExcerpt(character.tagline || character.creatorNotes, { max: 140 });

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-subtle transition-colors hover:border-brand/40"
      style={{ height: cardHeight }}
    >
      <Link
        to="/characters/$id"
        params={{ id: character.id }}
        aria-label={`Open ${character.name}`}
        className="focus-ring flex h-full flex-col rounded-xl"
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
          {showImage && avatarUrl ? (
            <OptimizedImage
              src={avatarUrl}
              alt=""
              preset="card"
              className="size-full object-cover motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:group-hover:scale-[1.02]"
              onError={() => setFailedSrc(avatarUrl)}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-raised">
              <span className="font-heading text-4xl text-2">{character.name.charAt(0)}</span>
            </div>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-2.5">
          <h3 className="truncate text-sm font-semibold" title={character.name}>
            {character.name}
          </h3>
          {excerpt ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-2">{excerpt}</p>
          ) : (
            <p className="mt-0.5 text-xs text-2">&nbsp;</p>
          )}
          {character.creator ? (
            <p className="mt-0.5 truncate text-[11px] text-2">by {character.creator}</p>
          ) : null}
          <div className="mt-auto">
            <div className="flex items-center gap-1.5 overflow-hidden">
              {character.tags.slice(0, 3).map((tag, index) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className={cn(
                    "max-w-[70px] shrink-0 truncate px-1.5 py-0 text-[11px] leading-tight",
                    index === 2 && "hidden sm:inline-flex",
                  )}
                >
                  {tag}
                </Badge>
              ))}
              {character.tags.length > 3 ? (
                <span className="shrink-0 text-[11px] text-2">+{character.tags.length - 3}</span>
              ) : null}
            </div>
            <div className="mt-1 flex items-center gap-1 whitespace-nowrap text-[11px] text-2 tabular-nums">
              <MessagesSquare className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {character.chatCount} · <RelativeTime date={character.updatedAt} compact />
              </span>
            </div>
          </div>
        </div>
      </Link>

      <div className="absolute right-2 top-2 z-10">
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
    </div>
  );
}
