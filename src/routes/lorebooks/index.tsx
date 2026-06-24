import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeleteLorebook, useLorebooks } from "@/hooks/useLorebooks";

export const Route = createFileRoute("/lorebooks/")({
  component: LorebooksPage,
});

function LorebooksPage() {
  const { data, isLoading, error } = useLorebooks();
  const deleteMutation = useDeleteLorebook();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lorebooks</h1>
          <p className="text-muted-foreground text-sm">
            Manage lorebooks and their keyword-triggered entries.
          </p>
        </div>
        <Button asChild>
          <Link to="/lorebooks/new">New Lorebook</Link>
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
              No lorebooks yet. Create one to start adding entries.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((lb) => (
            <Card key={lb.id}>
              <CardHeader>
                <CardTitle className="line-clamp-1">{lb.name}</CardTitle>
                {lb.description ? (
                  <CardDescription className="line-clamp-2">{lb.description}</CardDescription>
                ) : null}
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="secondary">
                    {lb.entryCount} {lb.entryCount === 1 ? "entry" : "entries"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex justify-between gap-2">
                <Button asChild size="sm">
                  <Link to="/lorebooks/$id" params={{ id: lb.id }}>
                    Open
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete lorebook "${lb.name}"? This removes all entries.`)) {
                      deleteMutation.mutate({ id: lb.id });
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
