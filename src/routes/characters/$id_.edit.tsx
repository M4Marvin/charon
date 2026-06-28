import { useCallback, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useCharacter, useUpdateCharacterData } from "@/hooks/useCharacters";

const editSchema = z.object({
  name: z.string().min(1, "Name is required").max(64, "Name must be at most 64 characters"),
  tagline: z.string().max(200, "Tagline must be at most 200 characters"),
  description: z.string(),
  personality: z.string(),
  scenario: z.string(),
  first_mes: z.string(),
  alternate_greetings: z.array(z.string()),
  mes_example: z.string(),
  creator_notes: z.string(),
  system_prompt: z.string(),
  post_history_instructions: z.string(),
  creator: z.string(),
  character_version: z.string(),
  tags: z.string(),
  talkativeness: z.string(),
});

export const Route = createFileRoute("/characters/$id_/edit")({
  component: CharacterEditPage,
});

function CharacterEditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: character, isLoading, error } = useCharacter(id);
  const updateMutation = useUpdateCharacterData();

  const form = useForm({
    defaultValues: {
      name: "",
      tagline: "",
      description: "",
      personality: "",
      scenario: "",
      first_mes: "",
      alternate_greetings: [""],
      mes_example: "",
      creator_notes: "",
      system_prompt: "",
      post_history_instructions: "",
      creator: "",
      character_version: "",
      tags: "",
      talkativeness: "50",
    },
    validators: { onSubmit: editSchema },
    onSubmit: async ({ value }) => {
      const data = character!.data;
      const tags = value.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const talkativeness = (() => {
        const n = Number(value.talkativeness);
        return isNaN(n) || n < 0 || n > 100 ? undefined : n;
      })();

      await updateMutation.mutateAsync({
        id,
        data: {
          ...data,
          name: value.name,
          description: value.description,
          personality: value.personality,
          scenario: value.scenario,
          first_mes: value.first_mes,
          alternate_greetings: value.alternate_greetings.filter(Boolean),
          mes_example: value.mes_example,
          creator_notes: value.creator_notes,
          system_prompt: value.system_prompt,
          post_history_instructions: value.post_history_instructions,
          creator: value.creator,
          character_version: value.character_version,
          tags,
          extensions: {
            ...data.extensions,
            ...(talkativeness !== undefined ? { talkativeness } : {}),
          },
        },
        tagline: value.tagline || null,
      });

      toast.success("Character saved");
      void navigate({ to: "/characters/$id", params: { id } });
    },
  });

  useEffect(() => {
    if (!character) return;
    const d = character.data;
    form.reset({
      name: d.name,
      tagline: character.tagline ?? "",
      description: d.description,
      personality: d.personality,
      scenario: d.scenario,
      first_mes: d.first_mes,
      alternate_greetings: d.alternate_greetings.length > 0 ? d.alternate_greetings : [""],
      mes_example: d.mes_example,
      creator_notes: d.creator_notes,
      system_prompt: d.system_prompt,
      post_history_instructions: d.post_history_instructions,
      creator: d.creator,
      character_version: d.character_version,
      tags: d.tags.join(", "),
      talkativeness: String(d.extensions.talkativeness ?? 50),
    });
  }, [character, form]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      e.stopPropagation();
      void form.handleSubmit();
    },
    [form],
  );

  const isPending = updateMutation.isPending;

  if (isLoading) {
    return (
      <LoadingSkeleton />
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link to="/characters">← Back</Link>
          </Button>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-destructive text-sm">Failed to load character: {error.message}</p>
        </div>
      </main>
    );
  }

  if (!character) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link to="/characters">← Back</Link>
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">Character not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link to="/characters/$id" params={{ id }}>← Back</Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          Editing {character.name}
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-8">
          {/* Basic Info */}
          <Section title="Basic Info">
            <form.Field
              name="name"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      autoFocus
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />
            <form.Field
              name="tagline"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Tagline</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Short description shown on cards"
                      autoComplete="off"
                    />
                    <FieldDescription>
                      Displayed on character cards. Auto-derived from description if empty.
                    </FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <form.Field
                name="creator"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Creator</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      autoComplete="off"
                    />
                  </Field>
                )}
              />
              <form.Field
                name="character_version"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Character Version</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="1.0"
                      autoComplete="off"
                    />
                  </Field>
                )}
              />
            </div>
          </Section>

          {/* Description & Personality */}
          <Section title="Description">
            <form.Field
              name="description"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      className="min-h-[120px]"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />
          </Section>

          <Separator />

          <Section title="Personality">
            <form.Field
              name="personality"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Personality</FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="min-h-[100px]"
                  />
                </Field>
              )}
            />
          </Section>

          <Separator />

          <Section title="Scenario">
            <form.Field
              name="scenario"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Scenario</FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="min-h-[100px]"
                  />
                </Field>
              )}
            />
          </Section>

          <Separator />

          {/* Messages */}
          <Section title="Messages">
            <form.Field
              name="first_mes"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>First Message</FieldLabel>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      className="min-h-[100px]"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />

            <form.Field
              name="alternate_greetings"
              mode="array"
              children={(field) => (
                <FieldSet>
                  <FieldLegend>Alternate Greetings</FieldLegend>
                  <FieldGroup data-slot="field-group">
                    {field.state.value.map((_, index) => (
                      <form.Field
                        key={index}
                        name={`alternate_greetings[${index}]`}
                        children={(subField) => (
                          <Field orientation="horizontal" className="items-start">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-mono shrink-0 mt-3">
                                  #{index + 1}
                                </span>
                                <Textarea
                                  id={subField.name}
                                  name={subField.name}
                                  value={subField.state.value}
                                  onBlur={subField.handleBlur}
                                  onChange={(e) => subField.handleChange(e.target.value)}
                                  className="min-h-[60px]"
                                />
                              </div>
                            </div>
                            {field.state.value.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 shrink-0 mt-2"
                                onClick={() => field.removeValue(index)}
                                aria-label={`Remove greeting ${index + 1}`}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            )}
                          </Field>
                        )}
                      />
                    ))}
                  </FieldGroup>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => field.pushValue("")}
                  >
                    <Plus className="size-4" />
                    Add Greeting
                  </Button>
                </FieldSet>
              )}
            />

            <form.Field
              name="mes_example"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Example Messages</FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <FieldDescription>
                    &lt;START&gt; dialog format for few-shot examples.
                  </FieldDescription>
                </Field>
              )}
            />
          </Section>

          <Separator />

          {/* Prompts */}
          <Section title="Prompts">
            <form.Field
              name="system_prompt"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>System Prompt</FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="min-h-[80px]"
                  />
                </Field>
              )}
            />
            <form.Field
              name="post_history_instructions"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Post-History Instructions</FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <FieldDescription>
                    Appended to the prompt after the chat history.
                  </FieldDescription>
                </Field>
              )}
            />
            <form.Field
              name="creator_notes"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Creator Notes</FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="min-h-[80px]"
                  />
                </Field>
              )}
            />
          </Section>

          <Separator />

          {/* Settings */}
          <Section title="Settings">
            <form.Field
              name="tags"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Tags</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="fantasy, adventure, romance"
                    autoComplete="off"
                  />
                  <FieldDescription>
                    Comma-separated list of tags.
                  </FieldDescription>
                </Field>
              )}
            />
            <form.Field
              name="talkativeness"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Talkativeness</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="number"
                      min={0}
                      max={100}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                    />
                    <FieldDescription>
                      How talkative the character is (0–100).
                    </FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />
          </Section>
        </div>

        <Separator className="my-8" />

        <div className="flex items-center justify-end gap-3">
          <Button asChild variant="ghost" type="button">
            <Link to="/characters/$id" params={{ id }}>Cancel</Link>
          </Button>
          <form.Subscribe
            selector={(state) => ({
              isSubmitting: state.isSubmitting,
              error: state.errorMap?.onSubmit,
            })}
            children={({ isSubmitting }) => (
              <>
                {updateMutation.isError ? (
                  <p className="text-destructive text-sm">
                    {updateMutation.error instanceof Error
                      ? updateMutation.error.message
                      : "Failed to save"}
                  </p>
                ) : null}
                <Button type="submit" disabled={isSubmitting || isPending}>
                  {isPending ? "Saving..." : "Save"}
                </Button>
              </>
            )}
          />
        </div>
      </form>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function FieldSet({ children }: { children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-lg border bg-muted/20 p-4">
      {children}
    </fieldset>
  );
}

function FieldLegend({ children }: { children: React.ReactNode }) {
  return (
    <legend className="text-sm font-medium text-muted-foreground px-1">
      {children}
    </legend>
  );
}

function LoadingSkeleton() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <div className="h-9 w-24 bg-muted rounded" />
      </div>
      <div className="space-y-8 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-4">
            <div className="h-6 bg-muted rounded w-32" />
            <div className="h-10 bg-muted rounded" />
            <div className="h-24 bg-muted rounded" />
          </div>
        ))}
      </div>
    </main>
  );
}
