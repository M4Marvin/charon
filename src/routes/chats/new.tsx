import { useState } from "react";
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
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [selectedGreetingIndex, setSelectedGreetingIndex] = useState<number>(0);

  const selectedChar =
    characters?.find((c) => c.id === selectedCharId) ?? null;

  const handleCreateChat = async () => {
    if (!selectedCharId) return;
    const result = await createMutation.mutateAsync({
      characterId: selectedCharId,
      greetingIndex: selectedGreetingIndex,
    });
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
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/chats">← Back</Link>
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">New Chat</h1>
        <p className="text-muted-foreground text-sm">
          Pick a character and a greeting to start a conversation.
        </p>
      </div>

      {!selectedCharId ? (
        <>
          <h2 className="mb-4 text-lg font-medium">Choose a character</h2>
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
                  onClick={() => setSelectedCharId(char.id)}
                >
                  <CardHeader>
                    {char.imagePath ? (
                      <Avatar className="mb-2 size-20 self-center">
                        <AvatarImage
                          src={`/api/characters/${char.id}/avatar`}
                          alt={char.name}
                        />
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
        </>
      ) : null}

      {selectedCharId && selectedChar ? (
        <GreetingSelector
          characterId={selectedCharId}
          greetingIndex={selectedGreetingIndex}
          onGreetingChange={setSelectedGreetingIndex}
          onBack={() => setSelectedCharId(null)}
          onCreate={handleCreateChat}
          isPending={createMutation.isPending}
        />
      ) : selectedCharId && !selectedChar ? (
        <GreetingSelector
          characterId={selectedCharId}
          greetingIndex={selectedGreetingIndex}
          onGreetingChange={setSelectedGreetingIndex}
          onBack={() => setSelectedCharId(null)}
          onCreate={handleCreateChat}
          isPending={createMutation.isPending}
        />
      ) : null}
    </main>
  );
}

function GreetingSelector({
  characterId,
  greetingIndex,
  onGreetingChange,
  onBack,
  onCreate,
  isPending,
}: {
  characterId: string;
  greetingIndex: number;
  onGreetingChange: (index: number) => void;
  onBack: () => void;
  onCreate: () => void;
  isPending: boolean;
}) {
  const { data: characters } = useCharacters();
  const char = characters?.find((c) => c.id === characterId);

  // We need the full character data to read first_mes and alternate_greetings.
  // Since we only have CharacterListItem here, show a loading state and
  // let the createChat server fn handle greeting selection.
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          {char?.imagePath ? (
            <Avatar>
              <AvatarImage src={`/api/characters/${char.id}/avatar`} alt={char?.name ?? "?"} />
              <AvatarFallback>{char?.name[0] ?? "?"}</AvatarFallback>
            </Avatar>
          ) : (
            <Avatar>
              <AvatarFallback>{char?.name[0] ?? "?"}</AvatarFallback>
            </Avatar>
          )}
          <div>
            <CardTitle>{char?.name ?? "Character"}</CardTitle>
            <CardDescription>Choose how to start the conversation</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Greeting</p>
          <p className="text-muted-foreground text-xs">
            The first message will be the default greeting. You can choose a different one below.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={greetingIndex === -1 ? "default" : "outline"}
            size="sm"
            onClick={() => onGreetingChange(-1)}
          >
            Random
          </Button>
          <Button
            variant={greetingIndex === 0 ? "default" : "outline"}
            size="sm"
            onClick={() => onGreetingChange(0)}
          >
            Default
          </Button>
        </div>

        <div className="flex justify-between gap-2 pt-2">
          <Button variant="ghost" onClick={onBack} disabled={isPending}>
            ← Pick another character
          </Button>
          <Button onClick={onCreate} disabled={isPending}>
            {isPending ? "Creating..." : "Start Chat"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
