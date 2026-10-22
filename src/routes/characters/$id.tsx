import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { UserRoundX } from "lucide-react";
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
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Label } from "@/components/ui/label";
import { EmbeddedLorebookPanel } from "@/components/character/EmbeddedLorebookPanel";
import { MarkdownContent } from "@/components/MarkdownContent";
import { CharacterPoster } from "@/components/character/character-poster";
import { CharacterDefinition } from "@/components/character/character-definition";
import { MoreByCreator } from "@/components/character/more-by-creator";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { RelativeTime } from "@/components/common/RelativeTime";
import { SkeletonForm } from "@/components/common/Skeletons";
import type { CharacterDetail } from "@/db/repositories/characters";
import { useCharacter, useDeleteCharacter, useUpdateCharacter } from "@/hooks/useCharacters";
import { useCreateChat, useChatsByCharacter } from "@/hooks/useChats";
import { withImageVersion } from "@/lib/image-optimization";
import { characterDeleteDescription } from "./delete-stats";

export const Route = createFileRoute("/characters/$id")({
  component: CharacterDetailPage,
});

export function CharacterDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: character, isLoading, error, refetch } = useCharacter(id);
  const deleteMutation = useDeleteCharacter();
  const createChatMutation = useCreateChat();
  const { data: characterChats } = useChatsByCharacter(id);
  const [renameOpen, setRenameOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const handleStartChat = async () => {
    if (!character || createChatMutation.isPending) return;
    try {
      const result = await createChatMutation.mutateAsync({ characterId: character.id });
      void navigate({ to: "/chat/$id", params: { id: result.id } });
    } catch (err) {
      toast.error(`Failed to start chat: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader backTo="/characters" />
        <div className="grid gap-8 lg:grid-cols-[minmax(280px,340px)_1fr]">
          <div className="aspect-[3/4] w-full animate-pulse rounded-xl bg-raised motion-reduce:animate-none" />
          <SkeletonForm />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="Character" backTo="/characters" />
        <ErrorBanner
          message={
            error instanceof Error
              ? `We couldn’t load this character. ${error.message}`
              : "We couldn’t load this character."
          }
          onRetry={() => void refetch()}
        />
      </main>
    );
  }

  if (!character) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="Character" backTo="/characters" />
        <EmptyState
          icon={UserRoundX}
          title="Character not found"
          description="It may have been deleted, or the link may be wrong."
        >
          <Button asChild variant="outline">
            <a href="/characters">Back to characters</a>
          </Button>
        </EmptyState>
      </main>
    );
  }

  const data = character.data;
  const creator = character.creator || data.creator;
  const avatarUrl = character.imagePath
    ? withImageVersion(`/api/characters/${character.id}/avatar`, character.imagePath)
    : null;

  return (
    <main className="relative isolate mx-auto w-full max-w-[1200px] px-4 py-6 pb-24 md:pb-8">
      {avatarUrl ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] overflow-hidden"
        >
          <OptimizedImage
            src={avatarUrl}
            alt=""
            preset="background"
            intrinsicSize={false}
            quality={60}
            className="h-full w-full scale-110 object-cover opacity-20 blur-3xl"
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>
      ) : null}

      <PageHeader
        title={character.name}
        backTo="/characters"
        subtitle={creator ? `@${creator}` : undefined}
        actions={
          <RowActionsMenu
            label="Character actions"
            text="Actions"
            items={[
              ...(characterChats && characterChats.length > 0
                ? [{ label: "New chat", onSelect: () => void handleStartChat() }]
                : []),
              {
                label: "Edit",
                onSelect: () => void navigate({ to: "/characters/$id/edit", params: { id } }),
              },
              { label: "Rename", onSelect: () => setRenameOpen(true) },
              { label: "Delete", destructive: true, onSelect: () => setDelOpen(true) },
            ]}
          />
        }
      />

      <div className="lg:grid lg:grid-cols-[minmax(280px,340px)_1fr] lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-20">
          <CharacterPoster
            character={character}
            chats={characterChats ?? []}
            onStartChat={handleStartChat}
            starting={createChatMutation.isPending}
          />
        </div>

        <div className="min-w-0">
          <div className="space-y-10">
            <header className="space-y-3">
              <p className="text-2 text-sm">
                {creator ? <>@{creator} · </> : null}
                Updated <RelativeTime date={character.updatedAt} /> · Created{" "}
                {character.createdAt.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              {character.tagline ? <p className="text-title text-2">{character.tagline}</p> : null}

              <div className="flex flex-wrap items-center gap-2">
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
                {data.tags.map((tag) => (
                  <Link key={tag} to="/characters" search={{ tags: tag }} className="focus-ring">
                    <Badge variant="secondary" className="text-[11px] font-normal">
                      {tag}
                    </Badge>
                  </Link>
                ))}
              </div>
            </header>

            {data.creator_notes ? (
              <section className="space-y-3">
                <h2 className="text-title">Creator Notes</h2>
                <MarkdownContent content={data.creator_notes} />
              </section>
            ) : null}

            <CharacterDefinition data={data} />

            <section className="space-y-3">
              <h2 className="text-title">Lorebook</h2>
              {data.character_book ? (
                <EmbeddedLorebookPanel book={data.character_book} />
              ) : (
                <p className="text-2 text-sm italic">No embedded lorebook.</p>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-title">Details</h2>
              <DetailsGrid character={character} />
            </section>

            {creator ? <MoreByCreator creator={creator} currentId={character.id} /> : null}
          </div>
        </div>
      </div>

      <RenameDialog character={character} open={renameOpen} onClose={() => setRenameOpen(false)} />
      <ConfirmDialog
        open={delOpen}
        onOpenChange={(o) => !o && setDelOpen(false)}
        title="Delete character"
        description={characterDeleteDescription(
          character.name,
          character.chatCount,
          character.messageCount,
        )}
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

function DetailsGrid({ character }: { character: CharacterDetail }) {
  const data = character.data;
  const rows: { label: string; value: string }[] = [
    { label: "Spec", value: `${character.spec} v${character.specVersion}` },
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
  ];
  return (
    <div className="rounded-xl border border-subtle divide-y">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
          <span className="w-28 shrink-0 text-2">{row.label}</span>
          <span className="text-1 break-all">{row.value}</span>
        </div>
      ))}
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
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
              minLength={1}
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
