import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCharacters, useDeleteCharacter } from "@/hooks/useCharacters";

export const Route = createFileRoute("/characters/")({
  component: CharactersPage,
});

function CharactersPage() {
  const { data, isLoading, error } = useCharacters();
  const deleteMutation = useDeleteCharacter();

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

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : error ? (
        <p className="text-destructive text-sm">Failed to load: {error.message}</p>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              No characters yet. Import a PNG character card to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((char) => (
            <Card key={char.id}>
              <CardHeader>
                {char.imagePath ? (
                  <img
                    src={`/api/characters/${char.id}/avatar`}
                    alt={char.name}
                    className="mb-2 aspect-square w-full rounded-md object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="bg-muted mb-2 aspect-square w-full rounded-md" />
                )}
                <CardTitle>{char.name}</CardTitle>
                <CardDescription>{char.spec}</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-between gap-2">
                <Button asChild size="sm">
                  <Link to="/characters/$id" params={{ id: char.id }}>
                    Open
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete character "${char.name}"?`)) {
                      deleteMutation.mutate({ id: char.id });
                    }
                  }}
                >
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
