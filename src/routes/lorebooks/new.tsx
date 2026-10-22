import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/common/PageHeader";
import { useCreateLorebook } from "@/hooks/useLorebooks";

export const Route = createFileRoute("/lorebooks/new")({
  component: NewLorebookPage,
});

function NewLorebookPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateLorebook();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Name is required.");
      return;
    }
    setNameError(null);
    setError(null);
    try {
      const result = await createMutation.mutateAsync({
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      void navigate({ to: "/lorebooks/$id", params: { id: result.id } });
    } catch (err) {
      setError(
        err instanceof Error
          ? `We couldn’t create the lorebook. ${err.message}`
          : "We couldn’t create the lorebook.",
      );
    }
  };

  return (
    <main className="mx-auto max-w-[768px] px-4 py-8">
      <PageHeader
        title="New Lorebook"
        backTo="/lorebooks"
        subtitle="A lorebook groups keyword-triggered entries that inject context into chats."
      />

      <Card>
        <CardHeader>
          <CardDescription>Name it now; you can add entries after creating it.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Field data-invalid={Boolean(nameError)}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="World Guide"
                disabled={createMutation.isPending}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? "name-error" : undefined}
                autoComplete="off"
              />
              {nameError ? <FieldError id="name-error">{nameError}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Description (optional)</FieldLabel>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this lorebook covers…"
                disabled={createMutation.isPending}
                rows={3}
              />
            </Field>

            {error ? (
              <p role="alert" className="text-danger text-sm">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="h-10 max-sm:h-11"
                aria-live="polite"
              >
                {createMutation.isPending ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
