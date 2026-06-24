import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useChats, useDeleteChat } from "@/hooks/useChats";

export const Route = createFileRoute("/chats/")({
  component: ChatsPage,
});

function ChatsPage() {
  const { data: chats, isLoading, error } = useChats();
  const deleteMutation = useDeleteChat();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chats</h1>
          <p className="text-muted-foreground text-sm">
            Your conversations with characters.
          </p>
        </div>
        <Button asChild>
          <Link to="/chats/new">New Chat</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : error ? (
        <p className="text-destructive text-sm">Failed to load: {error.message}</p>
      ) : !chats || chats.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              No chats yet. Pick a character to start chatting.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chats.map((chat) => (
            <Card key={chat.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  {chat.characterImagePath ? (
                    <img
                      src={`/api/characters/${chat.characterId}/avatar`}
                      alt={chat.characterName}
                      className="size-10 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="bg-muted size-10 rounded-full" />
                  )}
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{chat.title}</CardTitle>
                    <CardDescription className="truncate">
                      with {chat.characterName}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs">
                  {formatDate(chat.createdAt)}
                </p>
                <div className="flex gap-2">
                  <Button asChild size="sm">
                    <Link to="/chats/$id" params={{ id: chat.id }}>
                      Open
                    </Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete "${chat.title}"?`)) {
                        deleteMutation.mutate({ id: chat.id });
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
