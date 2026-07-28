import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, MessageSquareText, Telescope } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownContent } from "@/components/MarkdownContent";
import { CharacterActions } from "@/components/character/CharacterActions";
import { CharacterHero } from "@/components/character/CharacterHero";
import { EmbeddedLorebookPanel } from "@/components/character/EmbeddedLorebookPanel";
import { authClient } from "@/lib/auth-client";
import type { CharacterDetail } from "@/db/repositories/characters";
import { useCharacter, useDeleteCharacter, useUpdateCharacter } from "@/hooks/useCharacters";
import { useCreateChat } from "@/hooks/useChats";

export const Route = createFileRoute("/characters/$id")({
  component: CharacterDetailPage,
});

function CharacterDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const isDemo = session?.user?.role !== "admin";
  const { data: character, isLoading, error } = useCharacter(id);
  const deleteMutation = useDeleteCharacter();
  const createChatMutation = useCreateChat();
  const [renameOpen, setRenameOpen] = useState(false);

  const handleStartChat = async () => {
    if (!character || createChatMutation.isPending) return;
    try {
      const result = await createChatMutation.mutateAsync({ characterId: character.id });
      void navigate({ to: "/c/$id", params: { id: result.id } });
    } catch (err) {
      toast.error(
        `Failed to start chat: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link to="/characters">← Back</Link>
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-destructive text-sm">Failed to load: {error.message}</p>
        </div>
      ) : character ? (
        <div className="space-y-6">
          <CharacterHero character={character} />

          <CharacterActions
            onStartChat={handleStartChat}
            onEdit={() => void navigate({ to: "/characters/$id/edit", params: { id } })}
            onRename={() => setRenameOpen(true)}
            onDelete={() => {
              if (window.confirm(`Delete character "${character.name}"?`)) {
                deleteMutation.mutate(
                  { id: character.id },
                  {
                    onSuccess: () => void navigate({ to: "/characters" }),
                    onError: (err) =>
                      toast.error(
                        `Failed to delete: ${err instanceof Error ? err.message : String(err)}`,
                      ),
                  },
                );
              }
            }}
            deletePending={deleteMutation.isPending}
            isDemo={isDemo}
          />

          <Separator />

          <CharacterTabs character={character} />

          <RenameDialog
            character={character}
            open={renameOpen}
            onClose={() => setRenameOpen(false)}
          />
        </div>
      ) : null}
    </main>
  );
}

function CharacterTabs({ character }: { character: CharacterDetail }) {
  const data = character.data;
  const tabs = buildTabs(data);

  return (
    <Tabs defaultValue="overview">
      <TabsList variant="line" className="w-full justify-start gap-0 overflow-x-auto">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} disabled={tab.disabled}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview" className="mt-6">
        <div className="space-y-6">
          <SectionWithCopy title="Description">
            <MarkdownContent content={data.description} />
          </SectionWithCopy>

          {data.creator_notes ? (
            <SectionWithCopy title="Creator Notes">
              <MarkdownContent content={data.creator_notes} />
            </SectionWithCopy>
          ) : null}

          {data.extensions.depth_prompt ? (
            <SectionWithCopy title="Depth Prompt">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="text-xs font-normal">
                  role: {data.extensions.depth_prompt.role}
                </Badge>
                <Badge variant="outline" className="text-xs font-normal">
                  depth: {data.extensions.depth_prompt.depth}
                </Badge>
              </div>
              <MarkdownContent content={data.extensions.depth_prompt.prompt} />
            </SectionWithCopy>
          ) : null}

          <MetadataGrid character={character} />
        </div>
      </TabsContent>

      <TabsContent value="personality" className="mt-6">
        <SectionWithCopy title="Personality">
          <MarkdownContent content={data.personality} />
        </SectionWithCopy>
      </TabsContent>

      <TabsContent value="scenario" className="mt-6">
        <SectionWithCopy title="Scenario">
          <MarkdownContent content={data.scenario} />
        </SectionWithCopy>
      </TabsContent>

      <TabsContent value="first-message" className="mt-6">
        <div className="space-y-6">
          <SectionWithCopy title="First Message">
            <MarkdownContent content={data.first_mes} />
          </SectionWithCopy>

          {data.alternate_greetings.length > 0 ? (
            <SectionWithCopy
              title="Alternate Greetings"
              showCount={data.alternate_greetings.length}
            >
              <div className="space-y-3">
                {data.alternate_greetings.map((greeting, i) => (
                  <div key={i} className="bg-muted/40 rounded-md border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="text-[11px] font-normal">
                        #{i + 1}
                      </Badge>
                      <CopyButton text={greeting} />
                    </div>
                    <MarkdownContent content={greeting} />
                  </div>
                ))}
              </div>
            </SectionWithCopy>
          ) : null}
        </div>
      </TabsContent>

      <TabsContent value="example-messages" className="mt-6">
        <SectionWithCopy title="Example Messages">
          <MarkdownContent content={data.mes_example} />
        </SectionWithCopy>
      </TabsContent>

      <TabsContent value="prompts" className="mt-6">
        <div className="space-y-6">
          <SectionWithCopy title="System Prompt">
            <MarkdownContent content={data.system_prompt} />
          </SectionWithCopy>
          <SectionWithCopy title="Post-History Instructions">
            <MarkdownContent content={data.post_history_instructions} />
          </SectionWithCopy>
        </div>
      </TabsContent>

      <TabsContent value="lorebook" className="mt-6">
        {data.character_book ? (
          <EmbeddedLorebookPanel book={data.character_book} />
        ) : (
          <p className="text-muted-foreground text-sm">
            This character card has no embedded lorebook.
          </p>
        )}
      </TabsContent>
    </Tabs>
  );
}

interface TabDef {
  id: string;
  label: string;
  disabled: boolean;
}

function buildTabs(data: CharacterDetail["data"]): TabDef[] {
  return [
    { id: "overview", label: "Overview", disabled: !data.description && !data.creator_notes },
    { id: "personality", label: "Personality", disabled: !data.personality },
    { id: "scenario", label: "Scenario", disabled: !data.scenario },
    {
      id: "first-message",
      label: "First Message",
      disabled: !data.first_mes && data.alternate_greetings.length === 0,
    },
    { id: "example-messages", label: "Example Messages", disabled: !data.mes_example },
    {
      id: "prompts",
      label: "Prompts",
      disabled: !data.system_prompt && !data.post_history_instructions,
    },
    { id: "lorebook", label: "Lorebook", disabled: !data.character_book },
  ];
}

function SectionWithCopy({
  title,
  children,
  showCount,
}: {
  title: string;
  children: React.ReactNode;
  showCount?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">
          {title}
          {showCount !== undefined ? (
            <span className="text-muted-foreground font-normal text-sm ml-2">({showCount})</span>
          ) : null}
        </h3>
      </div>
      {children}
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
      className="size-7"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? (
        <span className="text-green-500 text-[10px] font-medium">✓</span>
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  );
}

function MetadataGrid({ character }: { character: CharacterDetail }) {
  const data = character.data;

  const rows: { label: string; value: string; icon?: React.ReactNode }[] = [
    { label: "Spec", value: `${character.spec} v${character.specVersion}` },
    ...(data.creator ? [{ label: "Creator", value: data.creator }] : []),
    ...(data.character_version ? [{ label: "Card Version", value: data.character_version }] : []),
    ...(data.extensions.world
      ? [{ label: "World", value: data.extensions.world, icon: <Telescope className="size-3.5" /> }]
      : []),
    ...(data.extensions.talkativeness !== undefined
      ? [
          {
            label: "Talkativeness",
            value: String(data.extensions.talkativeness),
            icon: <MessageSquareText className="size-3.5" />,
          },
        ]
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
    <div className="rounded-lg border bg-muted/30">
      <div className="px-4 py-3 border-b">
        <h3 className="text-base font-semibold">Metadata</h3>
      </div>
      <div className="divide-y">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
            <span className="text-muted-foreground shrink-0 w-28 flex items-center gap-1.5">
              {row.icon}
              {row.label}
            </span>
            <span className="text-foreground break-all">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="w-60 aspect-3/4 rounded-xl bg-muted shrink-0" />
        <div className="flex-1 space-y-4 py-2">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-4 bg-muted rounded w-72" />
          <div className="flex gap-2">
            <div className="h-5 bg-muted rounded w-16" />
            <div className="h-5 bg-muted rounded w-16" />
            <div className="h-5 bg-muted rounded w-16" />
          </div>
          <div className="h-4 bg-muted rounded w-40" />
        </div>
      </div>
      <div className="h-px bg-border" />
      <div className="flex gap-3">
        <div className="h-9 bg-muted rounded w-28" />
        <div className="h-9 bg-muted rounded w-20" />
        <div className="h-9 bg-muted rounded w-20" />
      </div>
      <div className="h-px bg-border" />
      <div className="space-y-4">
        <div className="h-6 bg-muted rounded w-40" />
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-5/6" />
        </div>
      </div>
    </div>
  );
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
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
