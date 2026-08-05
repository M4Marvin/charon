import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionNav } from "@/components/common/SectionNav";
import { SaveBar } from "@/components/common/SaveBar";
import { ChipInput } from "@/components/common/ChipInput";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { SkeletonForm } from "@/components/common/Skeletons";
import { authClient } from "@/lib/auth-client";
import { useCharacter, useUpdateCharacterData } from "@/hooks/useCharacters";

const editSchema = z.object({
  name: z.string().min(1).max(64),
  tagline: z.string().max(200),
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
  tags: z.array(z.string()),
  talkativeness: z.string(),
});

const SECTIONS = [
  { id: "basic", label: "Basic Info" },
  { id: "description", label: "Description" },
  { id: "personality", label: "Personality" },
  { id: "scenario", label: "Scenario" },
  { id: "messages", label: "Messages" },
  { id: "prompts", label: "Prompts" },
  { id: "settings", label: "Settings" },
];

export const Route = createFileRoute("/characters/$id_/edit")({
  component: CharacterEditPage,
});

function CharacterEditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const isDemo = session?.user?.role !== "admin";
  const { data: character, isLoading, error } = useCharacter(id);
  const updateMutation = useUpdateCharacterData();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (session && isDemo) {
      toast.error("Demo users cannot edit characters.");
      void navigate({ to: "/characters/$id", params: { id } });
    }
  }, [session, isDemo, id, navigate]);

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
      tags: [] as string[],
      talkativeness: "50",
    },
    validators: { onSubmit: editSchema },
    onSubmit: async ({ value }) => {
      setSaveError(null);
      try {
        const data = character!.data;
        const talkNum = (() => {
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
            tags: value.tags,
            extensions: {
              ...data.extensions,
              ...(talkNum !== undefined ? { talkativeness: talkNum } : {}),
            },
          },
          tagline: value.tagline || null,
        });
        toast.success("Character saved");
        void navigate({ to: "/characters/$id", params: { id } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setSaveError(msg);
        toast.error(`Save failed: ${msg}`);
      }
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
      tags: d.tags,
      talkativeness: String(d.extensions.talkativeness ?? 50),
    });
  }, [character, form]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      void form.handleSubmit();
    },
    [form],
  );

  if (isLoading)
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader backTo={`/characters/${id}`} />
        <SkeletonForm />
      </main>
    );
  if (error)
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="Edit Character" backTo={`/characters/${id}`} />
        <ErrorBanner message={(error as Error).message ?? "Failed to load"} />
      </main>
    );
  if (!character)
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="Edit Character" backTo={`/characters/${id}`} />
        <ErrorBanner message="Character not found." />
      </main>
    );

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 pb-24">
      <PageHeader title={`Editing ${character.name}`} backTo={`/characters/${id}`} />
      {saveError ? <ErrorBanner message={saveError} /> : null}
      <form onSubmit={handleSubmit}>
        <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-10">
          <SectionNav sections={SECTIONS} />
          <div className="max-w-3xl space-y-10 pt-2">
            <section id="basic" className="scroll-mt-24 space-y-4">
              <h2 className="text-title">Basic Info</h2>
              <form.Field
                name="name"
                children={(f: any) => (
                  <Field data-invalid={f.state.meta.isTouched && !f.state.meta.isValid}>
                    <FieldLabel htmlFor={f.name}>Name</FieldLabel>
                    <Input
                      id={f.name}
                      value={f.state.value}
                      onBlur={f.handleBlur}
                      onChange={(e) => f.handleChange(e.target.value)}
                    />
                    {f.state.meta.isTouched && !f.state.meta.isValid && (
                      <FieldError errors={f.state.meta.errors} />
                    )}
                  </Field>
                )}
              />
              <form.Field
                name="tagline"
                children={(f: any) => (
                  <Field data-invalid={f.state.meta.isTouched && !f.state.meta.isValid}>
                    <FieldLabel htmlFor={f.name}>Tagline</FieldLabel>
                    <Input
                      id={f.name}
                      value={f.state.value}
                      onBlur={f.handleBlur}
                      onChange={(e) => f.handleChange(e.target.value)}
                    />
                  </Field>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <form.Field
                  name="creator"
                  children={(f: any) => (
                    <Field>
                      <FieldLabel htmlFor={f.name}>Creator</FieldLabel>
                      <Input
                        id={f.name}
                        value={f.state.value}
                        onBlur={f.handleBlur}
                        onChange={(e) => f.handleChange(e.target.value)}
                        minLength={1}
                        maxLength={64}
                      />
                    </Field>
                  )}
                />
                <form.Field
                  name="character_version"
                  children={(f: any) => (
                    <Field>
                      <FieldLabel htmlFor={f.name}>Card Version</FieldLabel>
                      <Input
                        id={f.name}
                        value={f.state.value}
                        onBlur={f.handleBlur}
                        onChange={(e) => f.handleChange(e.target.value)}
                        placeholder="1.0"
                      />
                    </Field>
                  )}
                />
              </div>
            </section>
            <section id="description" className="scroll-mt-24 space-y-4">
              <h2 className="text-title">Description</h2>
              <form.Field
                name="description"
                children={(f: any) => (
                  <Field>
                    <FieldLabel htmlFor={f.name}>Description</FieldLabel>
                    <Textarea
                      id={f.name}
                      value={f.state.value}
                      onBlur={f.handleBlur}
                      onChange={(e) => f.handleChange(e.target.value)}
                      rows={6}
                    />
                  </Field>
                )}
              />
            </section>
            <Separator />
            <section id="personality" className="scroll-mt-24 space-y-4">
              <h2 className="text-title">Personality</h2>
              <form.Field
                name="personality"
                children={(f: any) => (
                  <Field>
                    <FieldLabel htmlFor={f.name}>Personality</FieldLabel>
                    <Textarea
                      id={f.name}
                      value={f.state.value}
                      onBlur={f.handleBlur}
                      onChange={(e) => f.handleChange(e.target.value)}
                      rows={4}
                    />
                  </Field>
                )}
              />
            </section>
            <Separator />
            <section id="scenario" className="scroll-mt-24 space-y-4">
              <h2 className="text-title">Scenario</h2>
              <form.Field
                name="scenario"
                children={(f: any) => (
                  <Field>
                    <FieldLabel htmlFor={f.name}>Scenario</FieldLabel>
                    <Textarea
                      id={f.name}
                      value={f.state.value}
                      onBlur={f.handleBlur}
                      onChange={(e) => f.handleChange(e.target.value)}
                      rows={4}
                    />
                  </Field>
                )}
              />
            </section>
            <Separator />
            <section id="messages" className="scroll-mt-24 space-y-4">
              <h2 className="text-title">Messages</h2>
              <form.Field
                name="first_mes"
                children={(f: any) => (
                  <Field>
                    <FieldLabel htmlFor={f.name}>First Message</FieldLabel>
                    <Textarea
                      id={f.name}
                      value={f.state.value}
                      onBlur={f.handleBlur}
                      onChange={(e) => f.handleChange(e.target.value)}
                      rows={4}
                    />
                  </Field>
                )}
              />
              <form.Field
                name="alternate_greetings"
                mode="array"
                children={(field: any) => (
                  <Field>
                    <FieldLabel>Alternate Greetings</FieldLabel>
                    <div className="space-y-2">
                      {field.state.value.map((_: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-3 text-xs font-mono mt-3">#{idx + 1}</span>
                          <form.Field
                            name={`alternate_greetings[${idx}]`}
                            children={(sub: any) => (
                              <div className="flex-1 flex gap-2 items-start">
                                <Textarea
                                  aria-label={`Alternate greeting ${idx + 1}`}
                                  value={sub.state.value}
                                  onBlur={sub.handleBlur}
                                  onChange={(e) => sub.handleChange(e.target.value)}
                                  rows={2}
                                />
                                {field.state.value.length > 1 ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 shrink-0 mt-1"
                                    onClick={() => field.removeValue(idx)}
                                    aria-label={`Remove greeting ${idx + 1}`}
                                  >
                                    <span className="text-destructive">×</span>
                                  </Button>
                                ) : null}
                              </div>
                            )}
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => field.pushValue("")}
                      >
                        + Add Greeting
                      </Button>
                    </div>
                  </Field>
                )}
              />
              <form.Field
                name="mes_example"
                children={(f: any) => (
                  <Field>
                    <FieldLabel htmlFor={f.name}>Example Messages</FieldLabel>
                    <Textarea
                      id={f.name}
                      value={f.state.value}
                      onBlur={f.handleBlur}
                      onChange={(e) => f.handleChange(e.target.value)}
                      rows={4}
                    />
                  </Field>
                )}
              />
            </section>
            <Separator />
            <section id="prompts" className="scroll-mt-24 space-y-4">
              <h2 className="text-title">Prompts</h2>
              <form.Field
                name="system_prompt"
                children={(f: any) => (
                  <Field>
                    <FieldLabel htmlFor={f.name}>System Prompt</FieldLabel>
                    <Textarea
                      id={f.name}
                      value={f.state.value}
                      onBlur={f.handleBlur}
                      onChange={(e) => f.handleChange(e.target.value)}
                      rows={3}
                    />
                  </Field>
                )}
              />
              <form.Field
                name="post_history_instructions"
                children={(f: any) => (
                  <Field>
                    <FieldLabel htmlFor={f.name}>Post-History Instructions</FieldLabel>
                    <Textarea
                      id={f.name}
                      value={f.state.value}
                      onBlur={f.handleBlur}
                      onChange={(e) => f.handleChange(e.target.value)}
                      rows={3}
                    />
                  </Field>
                )}
              />
              <form.Field
                name="creator_notes"
                children={(f: any) => (
                  <Field>
                    <FieldLabel htmlFor={f.name}>Creator Notes</FieldLabel>
                    <Textarea
                      id={f.name}
                      value={f.state.value}
                      onBlur={f.handleBlur}
                      onChange={(e) => f.handleChange(e.target.value)}
                      rows={3}
                    />
                  </Field>
                )}
              />
            </section>
            <Separator />
            <section id="settings" className="scroll-mt-24 space-y-4">
              <h2 className="text-title">Settings</h2>
              <form.Field
                name="tags"
                children={(field: any) => (
                  <Field>
                    <FieldLabel>Tags</FieldLabel>
                    <ChipInput
                      aria-label="Tags"
                      value={field.state.value}
                      onChange={(v) => field.handleChange(v)}
                      placeholder="Add tags..."
                    />
                  </Field>
                )}
              />
              <form.Field
                name="talkativeness"
                children={(field: any) => (
                  <Field>
                    <FieldLabel>Talkativeness</FieldLabel>
                    <div className="flex items-center gap-3">
                      <Slider
                        className="flex-1"
                        aria-label="Talkativeness"
                        value={[Number(field.state.value)]}
                        onValueChange={(v) => field.handleChange(String(v[0]))}
                        min={0}
                        max={100}
                        step={5}
                      />
                      <span className="text-2 text-xs font-mono tabular-nums w-8 text-right">
                        {field.state.value}
                      </span>
                    </div>
                  </Field>
                )}
              />
            </section>
          </div>
        </div>
      </form>
      {/* Route-leave guard (useBlocker) evaluated and deferred: the TanStack Router
          API is version-dependent; SaveBar + Discard confirm already covers in-page
          navigation. Browser back/forward still loses unsaved changes without a
          native beforeunload listener, which is acceptable for now. */}
      <SaveBar
        dirty={form.state.isDirty}
        saving={updateMutation.isPending}
        onSave={() => void form.handleSubmit()}
        onDiscard={() => setDiscardOpen(true)}
      />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={(o) => !o && setDiscardOpen(false)}
        title="Discard changes?"
        description="You have unsaved changes."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          form.reset();
          setDiscardOpen(false);
          void navigate({ to: `/characters/${id}` });
        }}
      />
    </main>
  );
}
