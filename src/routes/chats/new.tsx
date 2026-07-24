import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCharacters } from "@/hooks/useCharacters";
import { useCreateChat } from "@/hooks/useChats";

export const Route = createFileRoute("/chats/new")({
  component: NewChatPage,
});

function NewChatPage() {
  const navigate = useNavigate();
  const { data: characters, isLoading, error } = useCharacters();
  const createMutation = useCreateChat();

  const handleCreateChat = async (characterId: string) => {
    if (createMutation.isPending) return;
    const result = await createMutation.mutateAsync({ characterId });
    void navigate({ to: "/chats/$id", params: { id: result.id } });
  };

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-destructive text-sm">Failed to load: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Chat</h1>
          <p className="text-muted-foreground text-sm">Pick a character to start a conversation.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/chats">← Back</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading characters...</p>
      ) : !characters || characters.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              No characters available. Import one first.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {characters.map((char) => (
            <Card
              key={char.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => void handleCreateChat(char.id)}
            >
              <CardHeader>
                {char.imagePath ? (
                  <Avatar className="mb-2 size-20 self-center">
                    <AvatarImage src={`/${char.imagePath}`} alt={char.name} />
                    <AvatarFallback>{char.name[0]}</AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar className="mb-2 size-20 self-center">
                    <AvatarFallback className="text-lg">{char.name[0]}</AvatarFallback>
                  </Avatar>
                )}
                <CardTitle className="text-center text-base">{char.name}</CardTitle>
                <CardDescription className="text-center text-xs">
                  {char.spec} v{char.specVersion}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {createMutation.isPending ? (
        <p className="text-muted-foreground mt-4 text-sm">Creating chat...</p>
      ) : null}
    </main>
  );
}
