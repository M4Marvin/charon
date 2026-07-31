import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { type } from "arktype";
import { MessagesSquare, Plus, Search, UserRoundCog, X } from "lucide-react";
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
import {
  useCharacterSearch,
  useCharacterTagCounts,
  useDeleteCharacter,
} from "@/hooks/useCharacters";
import { authClient } from "@/lib/auth-client";
import { RelativeTime } from "@/components/common/RelativeTime";
import type { CharacterListItem } from "@/server/fns/characters";

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

const CARD_BODY_HEIGHT = 88;
const GAP = 12;

function getLaneCount(vw: number): number {
  const cw = Math.min(vw - 32, 1200);
  if (cw >= 1280) return 5;
  if (cw >= 1024) return 4;
  if (cw >= 640) return 3;
  return 2;
}

function getCardHeight(lanes: number, vw: number): number {
  const cw = Math.min(vw - 32, 1200);
  const laneW = (cw - (lanes - 1) * GAP) / lanes;
  return Math.ceil(laneW * (4 / 3) + CARD_BODY_HEIGHT);
}

function CharactersPage() {
  const { data: session } = authClient.useSession();
  const isDemo = session?.user?.role !== "admin";
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
  const cardHeight = getCardHeight(lanes, viewportWidth);
  const lanePct = 100 / lanes;
  const cw = Math.min(viewportWidth - 32, 1200);
  const laneW = Math.ceil((cw - (lanes - 1) * GAP) / lanes);
  const bodyHeight = cardHeight - laneW;

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
  const isEmpty = !isLoading && total === 0 && !q && tags.length === 0;
  const isNoMatches = !isLoading && total === 0 && (Boolean(q) || tags.length > 0);
  const isRefiltering = isFetching && !isFetchingNextPage && Boolean(searchData);

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 pb-24">
      <PageHeader
        title="Characters"
        subtitle={
          isInitialLoading
            ? "Loading..."
            : total > 0
              ? `${total.toLocaleString()} character${total !== 1 ? "s" : ""}`
              : "Import and manage your character cards."
        }
        actions={
          !isDemo ? (
            <Button asChild>
              <Link to="/characters/new">
                <Plus className="size-4 md:hidden" />
                <span className="hidden md:inline">Import PNG</span>
              </Link>
            </Button>
          ) : undefined
        }
      />

      {error && !isLoading ? (
        <ErrorBanner
          message={(error as Error).message ?? "Failed to load characters"}
          onRetry={() => refetch()}
        />
      ) : null}

      {isInitialLoading ? (
        <SkeletonCardGrid count={15} lanes={lanes} />
      ) : isEmpty ? (
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
          <div className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-base/85 backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  className="pl-9 pr-12"
                  placeholder="Search name, creator, notes..."
                  value={searchInput}
                  onChange={(e) => updateSearch(e.target.value)}
                />
                <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-3 sm:inline-flex">
                  /
                </kbd>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-fade-x">
              {tagCounts && tagCounts.length > 0 ? (
                <TagFilterPopover tags={tagCounts} selected={tags} onChange={updateTags} />
              ) : null}
              <Select value={sort} onValueChange={(v) => updateSort(v as SortKey)}>
                <SelectTrigger className="w-auto min-w-[140px] gap-1.5 shrink-0">
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
                    className="size-6 -m-1 p-1 inline-flex items-center justify-center rounded-sm hover:bg-muted-foreground/20"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              {tags.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => updateTags([])}
                >
                  Clear all
                </Button>
              ) : null}
            </div>
          </div>

          <div role="status" aria-live="polite" className="py-3 text-xs text-3 tabular-nums">
            {total.toLocaleString()} character{total !== 1 ? "s" : ""}
            {isRefiltering ? " …" : ""}
          </div>

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
              style={{ height: virtualizer.getTotalSize(), position: "relative" }}
            >
              {virtualItems.map((item) => {
                const char = items[item.index];
                if (!char) return null;
                return (
                  <div
                    key={char.id}
                    role="listitem"
                    style={{
                      position: "absolute",
                      top: item.start,
                      left: `${(item.lane / lanes) * 100}%`,
                      width: `${lanePct}%`,
                      paddingRight: item.lane < lanes - 1 ? GAP : undefined,
                      boxSizing: "border-box",
                    }}
                  >
                    <CharacterCard
                      character={char}
                      isDemo={isDemo}
                      bodyHeight={bodyHeight}
                      onDelete={() => setDeletingId(char.id)}
                    />
                  </div>
                );
              })}
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
  bodyHeight,
  onDelete,
}: {
  character: CharacterListItem;
  isDemo: boolean;
  bodyHeight: number;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const imgRef = useRef<HTMLImageElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const img = imgRef.current;
    if (!img) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    img.style.transform = `scale(1.08) translate(${x * -8}px, ${y * -8}px)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (imgRef.current) imgRef.current.style.transform = "";
  }, []);

  const excerpt = character.tagline || character.creatorNotes;

  return (
    <div
      className="group relative rounded-xl border border-subtle overflow-hidden transition-shadow hover:shadow-lg hover:border-brand/40"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        to="/characters/$id"
        params={{ id: character.id }}
        className="block focus-ring rounded-xl"
      >
        <div className="relative aspect-square bg-muted overflow-hidden">
          {character.imagePath ? (
            <img
              ref={imgRef}
              src={`/api/characters/${character.id}/avatar`}
              alt={character.name}
              loading="lazy"
              decoding="async"
              className="size-full object-cover motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-raised">
              <span className="text-4xl font-heading text-3">{character.name.charAt(0)}</span>
            </div>
          )}
        </div>
        <div className="p-2 flex flex-col" style={{ height: bodyHeight }}>
          <h3 className="text-sm font-semibold truncate">{character.name}</h3>
          {excerpt ? (
            <p className="text-2 text-xs line-clamp-2 leading-snug mt-0.5">{excerpt}</p>
          ) : (
            <p className="text-2 text-xs">&nbsp;</p>
          )}
          {character.creator ? (
            <p className="text-3 text-[11px] truncate mt-0.5">by {character.creator}</p>
          ) : null}
          <div className="mt-auto">
            <div className="flex items-center gap-1.5 overflow-hidden">
              {character.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 leading-tight shrink-0"
                >
                  {tag}
                </Badge>
              ))}
              {character.tags.length > 3 ? (
                <span className="text-2 text-[10px] shrink-0">+{character.tags.length - 3}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-1 text-3 text-[10px] tabular-nums mt-1">
              <MessagesSquare className="size-3" />
              {character.chatCount}
              <span aria-hidden className="mx-0.5">
                ·
              </span>
              <RelativeTime date={character.updatedAt} />
            </div>
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
