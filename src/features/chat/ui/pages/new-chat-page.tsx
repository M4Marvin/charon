import { useMemo, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { SkeletonCardGrid } from "@/components/common/Skeletons";
import { useCharacters } from "@/hooks/useCharacters";
import { useCreateChat, useDeleteChat, useChats } from "@/hooks/useChats";

export function NewChatPage() {
  const navigate = useNavigate();
  const { data: characters, isLoading, error } = useCharacters();
  const { data: chats } = useChats();
  const createChat = useCreateChat();
  const deleteChat = useDeleteChat();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!characters) return [];
    if (!search.trim()) return characters;
    const q = search.toLowerCase();
    return characters.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.creatorNotes.toLowerCase().includes(q),
    );
  }, [characters, search]);

  const recentIds = useMemo(() => {
    if (!chats) return [] as string[];
    const seen = new Set<string>();
    const ids = [] as string[];
    for (const chat of chats) {
      if (!seen.has(chat.characterId)) {
        seen.add(chat.characterId);
        ids.push(chat.characterId);
      }
      if (ids.length >= 3) break;
    }
    return ids;
  }, [chats]);

  const recent = useMemo(() => {
    if (!characters) return [];
    return recentIds.map((id) => characters.find((c) => c.id === id)).filter(Boolean) as typeof characters;
  }, [characters, recentIds]);

  const handleSelect = async (characterId: string) => {
    try {
      const chat = await createChat.mutateAsync({ characterId });
      toast.success(`Chat started`, {
        action: {
          label: "Undo",
          onClick: () => {
            deleteChat.mutate({ id: chat.id });
            navigate({ to: "/c/new" });
          },
        },
        duration: 5000,
      });
      navigate({ to: "/c/$id", params: { id: chat.id } });
    } catch (err) {
      toast.error(`Failed to create chat: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="New Chat" backTo="/c" />
        <SkeletonCardGrid count={6} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="New Chat" backTo="/c" />
        <ErrorBanner message={(error as Error).message ?? "Failed to load characters"} />
      </main>
    );
  }

  if (characters && characters.length === 0) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="New Chat" backTo="/c" />
        <EmptyState icon={Users} title="No characters yet" description="Import a character card to start chatting.">
          <Button asChild>
            <Link to="/characters/new">Import Character</Link>
          </Button>
        </EmptyState>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <PageHeader title="New Chat" backTo="/c" />

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search characters..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {recent.length > 0 && !search.trim() ? (
        <div className="mb-8">
          <h3 className="text-2 text-sm font-medium mb-3">Recent</h3>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {recent.map((char) => (
              <CharacterCard key={char.id} character={char} onClick={() => handleSelect(char.id)} />
            ))}
          </div>
        </div>
      ) : null}

      {filtered.length === 0 && search.trim() ? (
        <p className="py-12 text-center text-2 text-sm">No characters match your search.</p>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((char) => (
            <CharacterCard key={char.id} character={char} onClick={() => handleSelect(char.id)} />
          ))}
        </div>
      )}
    </main>
  );
}

function CharacterCard({
  character,
  onClick,
}: {
  character: NonNullable<ReturnType<typeof useCharacters>["data"]>[number];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative block w-full rounded-xl border bg-card overflow-hidden transition-shadow hover:shadow-lg focus-ring text-left cursor-pointer"
    >
      {/* Avatar area */}
      <div className="aspect-[3/4] relative bg-muted overflow-hidden">
        {character.imagePath ? (
          <img
            src={`/api/characters/${character.id}/avatar`}
            alt={character.name}
            className="absolute inset-0 size-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-3">
          <p className="text-headline text-white truncate text-shadow-readable">{character.name}</p>
          <p className="text-xs text-white/70 line-clamp-1">{character.creatorNotes || character.creator || null}</p>
        </div>
        <Badge className="absolute top-2 right-2 text-[10px]" variant="secondary">
          {character.spec === "chara_card_v3" ? "V3" : "V2"}
        </Badge>
      </div>
    </button>
  );
}
