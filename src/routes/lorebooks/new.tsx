import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateLorebook } from "@/hooks/useLorebooks";

export const Route = createFileRoute("/lorebooks/new")({
  component: NewLorebookPage,
});

function NewLorebookPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateLorebook();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setError(null);
    try {
      const result = await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      void navigate({ to: "/lorebooks/$id", params: { id: result.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lorebook");
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/lorebooks">← Back</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Lorebook</CardTitle>
          <CardDescription>
            A lorebook groups keyword-triggered entries that inject context into chats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="World Guide"
                disabled={createMutation.isPending}
                required
                minLength={1}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this lorebook covers..."
                disabled={createMutation.isPending}
                rows={3}
              />
            </div>

            {error ? <p className="text-destructive text-sm">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <Button asChild variant="ghost" type="button">
                <Link to="/lorebooks">Cancel</Link>
              </Button>
              <Button type="submit" disabled={createMutation.isPending} aria-live="polite">
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
