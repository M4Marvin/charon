import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { useCharacters } from "@/hooks/useCharacters";
import { useCreateChat } from "@/hooks/useChats";

export function NewChatPage() {
  const navigate = useNavigate();
  const { data: characters, isLoading, error } = useCharacters();
  const createChat = useCreateChat();

  const handleSelect = async (characterId: string) => {
    const chat = await createChat.mutateAsync({ characterId });
    navigate({ to: "/c/$id", params: { id: chat.id } });
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <div className="mb-8 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-9 rounded-full" asChild>
            <Link to="/c" aria-label="Back to chats">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <h1 className="font-heading text-2xl text-[--sea-ink]">New Chat</h1>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2 text-[--sea-ink-soft]">
              <span className="size-2 rounded-full bg-[--lagoon] animate-bounce" />
              <span className="size-2 rounded-full bg-[--lagoon] animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="size-2 rounded-full bg-[--lagoon] animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-20">
            <p className="text-red-400">Failed to load characters.</p>
          </div>
        )}

        {characters && characters.length === 0 && (
          <div className="glass rounded-2xl px-8 py-16 text-center">
            <p className="text-[--sea-ink-soft] mb-4 text-sm">
              No characters yet. Import one to start chatting.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link to="/characters">Import Character</Link>
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {characters?.map((char) => (
            <Card
              key={char.id}
              className="glass group cursor-pointer transition-all hover:bg-white/5 border-transparent hover:border-[--lagoon]/20"
              onClick={() => handleSelect(char.id)}
            >
              <CardHeader className="items-center gap-3 pb-3">
                <Avatar className="size-20 shrink-0 rounded-2xl ring-1 ring-white/10 transition-transform group-hover:scale-105">
                  <AvatarImage
                    src={char.imagePath ? `/${char.imagePath}` : undefined}
                    alt={char.name}
                    className="object-cover"
                  />
                  <AvatarFallback className="rounded-2xl bg-[--lagoon]/20 text-[--lagoon] text-2xl">
                    {char.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="font-heading text-sm text-[--sea-ink] text-center truncate max-w-full">
                  {char.name}
                </CardTitle>
                <Badge variant="secondary" className="text-[10px]">
                  {char.spec}
                </Badge>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
