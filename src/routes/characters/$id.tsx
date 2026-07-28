import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Copy, MessageCircle, Calendar, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownContent } from "@/components/MarkdownContent";
import { EmbeddedLorebookPanel } from "@/components/character/EmbeddedLorebookPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionNav } from "@/components/common/SectionNav";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { StatChip } from "@/components/common/StatChip";
import { SkeletonForm } from "@/components/common/Skeletons";
import { authClient } from "@/lib/auth-client";
import type { CharacterDetail } from "@/db/repositories/characters";
import { useCharacter, useDeleteCharacter, useUpdateCharacter } from "@/hooks/useCharacters";
import { useCreateChat } from "@/hooks/useChats";

export const Route = createFileRoute("/characters/$id")({
  component: CharacterDetailPage,
});

const SECTIONS = [
  { id: "description", label: "Description" },
  { id: "personality", label: "Personality" },
  { id: "scenario", label: "Scenario" },
  { id: "greetings", label: "Greetings" },
  { id: "example-messages", label: "Example Messages" },
  { id: "prompts", label: "Prompts" },
  { id: "lorebook", label: "Lorebook" },
  { id: "metadata", label: "Metadata" },
];

function CharacterDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const isDemo = session?.user?.role !== "admin";
  const { data: character, isLoading, error } = useCharacter(id);
  const deleteMutation = useDeleteCharacter();
  const createChatMutation = useCreateChat();
  const [renameOpen, setRenameOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const handleStartChat = async () => {
    if (!character || createChatMutation.isPending) return;
    try {
      const result = await createChatMutation.mutateAsync({ characterId: character.id });
      void navigate({ to: "/c/$id", params: { id: result.id } });
    } catch (err) {
      toast.error(`Failed to start chat: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader backTo="/characters" />
        <SkeletonForm />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="Character" backTo="/characters" />
        <ErrorBanner message={(error as Error).message ?? "Failed to load character"} />
      </main>
    );
  }

  if (!character) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="Character" backTo="/characters" />
        <ErrorBanner message="Character not found." />
      </main>
    );
  }

  const data = character.data;
  const sectionsWithEmpty = SECTIONS.map((s) => ({
    ...s,
    empty: isSectionEmpty(s.id, data),
  }));

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <PageHeader backTo="/characters" />

      {/* Hero */}
      <div className="mb-8 space-y-6">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="shrink-0">
            {character.imagePath ? (
              <img
                src={`/api/characters/${character.id}/avatar`}
                alt={character.name}
                className="w-40 sm:w-40 aspect-[3/4] rounded-xl object-cover border shadow-lg"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="w-40 aspect-[3/4] rounded-xl bg-muted border flex items-center justify-center">
                <User className="size-12 text-muted-foreground/40" />
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0 justify-center gap-2">
            <h1 className="text-display">{character.name}</h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-2">
              {data.creator ? (
                <span className="flex items-center gap-1">
                  <User className="size-3.5" />
                  {data.creator}
                </span>
              ) : null}
              <Badge variant="secondary" className="text-xs font-normal">
                {character.spec}
              </Badge>
              <Badge variant="outline" className="text-xs font-normal">
                v{character.specVersion}
              </Badge>
              {data.character_version ? (
                <Badge variant="outline" className="text-xs font-normal">
                  card v{data.character_version}
                </Badge>
              ) : null}
            </div>
            {data.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {data.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[11px] font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <StatChip
                icon={MessageCircle}
                value={character.chatCount}
                label={character.chatCount === 1 ? "chat" : "chats"}
              />
              <StatChip
                icon={MessageCircle}
                value={character.userMessageCount}
                label={character.userMessageCount === 1 ? "turn" : "turns"}
              />
              <StatChip
                icon={Calendar}
                value={character.updatedAt.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                label="updated"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleStartChat} disabled={createChatMutation.isPending}>
            <MessageCircle className="size-4" />
            Start Chat
          </Button>
          {!isDemo ? (
            <RowActionsMenu
              label="Character actions"
              items={[
                {
                  label: "Edit",
                  onSelect: () => void navigate({ to: "/characters/$id/edit", params: { id } }),
                },
                { label: "Rename", onSelect: () => setRenameOpen(true) },
                { label: "Delete", destructive: true, onSelect: () => setDelOpen(true) },
              ]}
            />
          ) : null}
        </div>
        {/* Mobile sticky start chat */}
        <div className="fixed bottom-16 left-0 right-0 z-30 border-t bg-popover/95 px-4 py-3 backdrop-blur-sm md:hidden">
          <Button
            onClick={handleStartChat}
            disabled={createChatMutation.isPending}
            className="w-full"
          >
            <MessageCircle className="size-4" />
            Start Chat
          </Button>
        </div>
      </div>

      {/* Content: SectionNav + scroll sections */}
      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-10">
        <SectionNav sections={sectionsWithEmpty} />
        <div className="max-w-3xl space-y-12 pt-2">
          <ContentSection id="description" title="Description">
            {data.description ? (
              <MarkdownContent content={data.description} />
            ) : (
              <EmptySection text="No description defined." />
            )}
            {data.creator_notes ? (
              <div className="mt-6">
                <h4 className="text-headline mb-3">Creator Notes</h4>
                <MarkdownContent content={data.creator_notes} />
              </div>
            ) : null}
            {data.extensions.depth_prompt ? (
              <div className="mt-6">
                <h4 className="text-headline mb-3">Depth Prompt</h4>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary">role: {data.extensions.depth_prompt.role}</Badge>
                  <Badge variant="outline">depth: {data.extensions.depth_prompt.depth}</Badge>
                </div>
                <MarkdownContent content={data.extensions.depth_prompt.prompt} />
              </div>
            ) : null}
          </ContentSection>
          <ContentSection id="personality" title="Personality">
            {data.personality ? (
              <MarkdownContent content={data.personality} />
            ) : (
              <EmptySection text="No personality defined." />
            )}
          </ContentSection>
          <ContentSection id="scenario" title="Scenario">
            {data.scenario ? (
              <MarkdownContent content={data.scenario} />
            ) : (
              <EmptySection text="No scenario defined." />
            )}
          </ContentSection>
          <ContentSection id="greetings" title="Greetings">
            {data.first_mes ? (
              <div className="space-y-4">
                <div className="bg-card border rounded-lg p-4">
                  <MarkdownContent content={data.first_mes} />
                </div>
                {data.alternate_greetings.length > 0 ? (
                  <AlternateGreetings greetings={data.alternate_greetings} />
                ) : null}
              </div>
            ) : (
              <EmptySection text="No greetings defined." />
            )}
          </ContentSection>
          <ContentSection id="example-messages" title="Example Messages">
            {data.mes_example ? (
              <MarkdownContent content={data.mes_example} />
            ) : (
              <EmptySection text="No example messages defined." />
            )}
          </ContentSection>
          <ContentSection id="prompts" title="Prompts">
            <div className="space-y-6">
              <div>
                <h4 className="text-headline mb-3">System Prompt</h4>
                {data.system_prompt ? (
                  <MarkdownContent content={data.system_prompt} />
                ) : (
                  <EmptySection text="No system prompt defined." />
                )}
              </div>
              <div>
                <h4 className="text-headline mb-3">Post-History Instructions</h4>
                {data.post_history_instructions ? (
                  <MarkdownContent content={data.post_history_instructions} />
                ) : (
                  <EmptySection text="No post-history instructions defined." />
                )}
              </div>
            </div>
          </ContentSection>
          <ContentSection id="lorebook" title="Lorebook">
            {data.character_book ? (
              <EmbeddedLorebookPanel book={data.character_book} />
            ) : (
              <EmptySection text="No embedded lorebook." />
            )}
          </ContentSection>
          <ContentSection id="metadata" title="Metadata">
            <MetadataGrid character={character} />
          </ContentSection>
        </div>
      </div>

      <RenameDialog character={character} open={renameOpen} onClose={() => setRenameOpen(false)} />
      <ConfirmDialog
        open={delOpen}
        onOpenChange={(o) => !o && setDelOpen(false)}
        title="Delete character"
        description="This will permanently delete this character and all associated chats and messages. This action cannot be undone."
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          deleteMutation.mutate(
            { id: character.id },
            {
              onSuccess: () => void navigate({ to: "/characters" }),
              onError: (err) =>
                toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`),
            },
          );
        }}
      />
    </main>
  );
}

function ContentSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-title mb-4">{title}</h2>
      {children}
    </section>
  );
}

function EmptySection({ text }: { text: string }) {
  return <p className="text-3 text-sm italic">{text}</p>;
}

function AlternateGreetings({ greetings }: { greetings: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const isMany = greetings.length > 2;
  const shown = expanded || !isMany ? greetings : greetings.slice(0, 2);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-headline">Alternate Greetings ({greetings.length})</h4>
      </div>
      {shown.map((greeting, i) => (
        <div key={i} className="bg-card border rounded-lg p-4 group/copy relative">
          <Badge variant="secondary" className="text-[11px] font-normal mb-2">
            #{i + 1}
          </Badge>
          <div className="absolute top-3 right-3 opacity-0 group-hover/copy:opacity-100 transition-opacity">
            <CopyButton text={greeting} />
          </div>
          <MarkdownContent content={greeting} />
        </div>
      ))}
      {isMany && !expanded ? (
        <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
          Show {greetings.length - 2} more
        </Button>
      ) : null}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? (
        <span className="text-success text-[10px] font-medium">✓</span>
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  );
}

function MetadataGrid({ character }: { character: CharacterDetail }) {
  const data = character.data;
  const rows: { label: string; value: string }[] = [
    { label: "Spec", value: `${character.spec} v${character.specVersion}` },
    ...(data.creator ? [{ label: "Creator", value: data.creator }] : []),
    ...(data.character_version ? [{ label: "Card Version", value: data.character_version }] : []),
    ...(data.extensions.world ? [{ label: "World", value: data.extensions.world }] : []),
    ...(data.extensions.talkativeness !== undefined
      ? [{ label: "Talkativeness", value: String(data.extensions.talkativeness) }]
      : []),
    {
      label: "Created",
      value: character.createdAt.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
    {
      label: "Updated",
      value: character.updatedAt.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
    ...(data.tags.length > 0
      ? [{ label: "Tags", value: data.tags.map((t) => `#${t}`).join(", ") }]
      : []),
  ];
  return (
    <div className="rounded-lg border divide-y">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
          <span className="text-2 shrink-0 w-28">{row.label}</span>
          <span className="text-1 break-all">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function isSectionEmpty(id: string, data: CharacterDetail["data"]): boolean {
  switch (id) {
    case "description":
      return !data.description && !data.creator_notes && !data.extensions.depth_prompt;
    case "personality":
      return !data.personality;
    case "scenario":
      return !data.scenario;
    case "greetings":
      return !data.first_mes && data.alternate_greetings.length === 0;
    case "example-messages":
      return !data.mes_example;
    case "prompts":
      return !data.system_prompt && !data.post_history_instructions;
    case "lorebook":
      return !data.character_book;
    case "metadata":
      return false;
    default:
      return false;
  }
}

function RenameDialog({
  character,
  open,
  onClose,
}: {
  character: CharacterDetail;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(character.name);
  const [error, setError] = useState<string | null>(null);
  const updateMutation = useUpdateCharacter();
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name cannot be empty.");
      return;
    }
    if (trimmed === character.name) {
      onClose();
      return;
    }
    setError(null);
    try {
      await updateMutation.mutateAsync({ id: character.id, name: trimmed });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename");
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Character</DialogTitle>
          <DialogDescription>
            Renames the character record. The card data inside is unchanged.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename">Name</Label>
            <Input
              id="rename"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              disabled={updateMutation.isPending}
              autoFocus
              required
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
