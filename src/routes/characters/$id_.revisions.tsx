import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { History, UserRoundX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonRows } from "@/components/common/Skeletons";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { RelativeTime } from "@/components/common/RelativeTime";
import { plainExcerpt } from "@/lib/plain-text";
import { isCharacterNotFound } from "@/lib/app-errors";
import { friendlyLoadError } from "@/lib/error-copy";
import {
  useCharacter,
  useCharacterRevision,
  useCharacterRevisions,
  useRestoreCharacterRevision,
} from "@/hooks/useCharacters";
import { diffCharacterSnapshots, type CharacterSnapshot } from "@/lib/character/diff";
import type { CharacterDataV2 } from "@/lib/st-core/character";
import type { RevisionSummary } from "@/db/repositories/character-revisions";

export const Route = createFileRoute("/characters/$id_/revisions")({
  component: CharacterRevisionsPage,
});

export function CharacterRevisionsPage() {
  const { id } = Route.useParams();
  const { data: character, error: characterError } = useCharacter(id);
  const { data: revisions, isLoading, error, refetch } = useCharacterRevisions(id);
  // One shared restore mutation: while it is pending, every row's Restore
  // is disabled, so a second restore cannot race the first (last-write-wins
  // would silently discard it).
  const restoreMutation = useRestoreCharacterRevision();

  // Deleted character (e.g. another tab deleted it mid-visit): the revision
  // list stays nonempty until its next refetch, so a genuine not-found must
  // replace the page instead of leaving restorable-looking rows behind.
  // Other character-load errors are ignored — the list works without the
  // subtitle, mirroring the import page's policy.
  if (isCharacterNotFound(characterError)) {
    return (
      <main className="mx-auto max-w-[900px] px-4 py-8 pb-28 md:pb-8">
        <PageHeader title="Version history" backTo="/characters" />
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

  return (
    <main className="mx-auto max-w-[900px] px-4 py-8 pb-28 md:pb-8">
      <PageHeader title="Version history" subtitle={character?.name} backTo={`/characters/${id}`} />
      <p className="text-2 mb-6 text-sm">
        A snapshot is taken every time the character is saved. Restoring copies an old version
        forward — the history itself is never rewritten.
      </p>

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : error ? (
        <ErrorBanner
          message={friendlyLoadError(error, "We couldn’t load this history.")}
          onRetry={() => void refetch()}
        />
      ) : !revisions || revisions.length === 0 ? (
        <EmptyState
          icon={History}
          title="No versions yet"
          description="Saving an edit to this character will create the first version here."
        />
      ) : (
        <RevisionList characterId={id} revisions={revisions} restoreMutation={restoreMutation} />
      )}
    </main>
  );
}

function RevisionList({
  characterId,
  revisions,
  restoreMutation,
}: {
  characterId: string;
  revisions: RevisionSummary[];
  restoreMutation: ReturnType<typeof useRestoreCharacterRevision>;
}) {
  return (
    <ol className="space-y-3">
      {revisions.map((revision, index) => (
        <RevisionRow
          key={revision.id}
          characterId={characterId}
          revision={revision}
          previousRev={revisions[index + 1]?.rev ?? null}
          isCurrent={index === 0}
          restoreMutation={restoreMutation}
        />
      ))}
    </ol>
  );
}

function RevisionRow({
  characterId,
  revision,
  previousRev,
  isCurrent,
  restoreMutation,
}: {
  characterId: string;
  revision: RevisionSummary;
  previousRev: number | null;
  isCurrent: boolean;
  restoreMutation: ReturnType<typeof useRestoreCharacterRevision>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const handleRestore = () => {
    if (restoreMutation.isPending) return;
    restoreMutation.mutate(
      { id: characterId, rev: revision.rev },
      {
        onSuccess: () => {
          setRestoreOpen(false);
          toast.success(`Restored version ${revision.rev}`);
        },
        onError: (err) =>
          toast.error(
            friendlyLoadError(err, `Restoring version ${revision.rev} failed. Try again.`),
          ),
      },
    );
  };

  return (
    <li className="rounded-xl border border-subtle bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-1 text-sm font-medium">{revision.name}</span>
            {isCurrent ? (
              <Badge variant="secondary" className="text-xs font-normal">
                Current
              </Badge>
            ) : null}
          </div>
          <p className="text-3 text-xs">
            Version {revision.rev} · saved <RelativeTime date={revision.createdAt} />
            {revision.tagline ? ` · ${revision.tagline}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {previousRev !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Hide changes" : "Changes"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isCurrent || restoreMutation.isPending}
            onClick={() => setRestoreOpen(true)}
          >
            Restore
          </Button>
        </div>
      </div>
      {expanded && previousRev !== null ? (
        <div className="border-t border-subtle px-4 py-3">
          <RevisionDiff characterId={characterId} rev={revision.rev} previousRev={previousRev} />
        </div>
      ) : null}
      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={(o) => !o && setRestoreOpen(false)}
        title={`Restore version ${revision.rev}?`}
        description={`“${revision.name}” will replace the current character data. This save is itself recorded as a new version. The current portrait is kept — art is not part of a version.`}
        confirmLabel="Restore"
        loadingLabel="Restoring…"
        loading={restoreMutation.isPending}
        onConfirm={handleRestore}
      />
    </li>
  );
}

function RevisionDiff({
  characterId,
  rev,
  previousRev,
}: {
  characterId: string;
  rev: number;
  previousRev: number;
}) {
  const {
    data: newer,
    isLoading: newerLoading,
    error: newerError,
  } = useCharacterRevision(characterId, rev);
  const {
    data: older,
    isLoading: olderLoading,
    error: olderError,
  } = useCharacterRevision(characterId, previousRev);

  if (newerLoading || olderLoading) return <SkeletonRows rows={2} />;
  if (newerError || olderError) {
    return <ErrorBanner message="Couldn’t load the changed fields." />;
  }
  if (!newer || !older) return null;

  const diffs = diffCharacterSnapshots(toSnapshot(older), toSnapshot(newer));
  if (diffs.length === 0) {
    return (
      <p className="text-2 text-sm italic">No tracked fields differ between these versions.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {diffs.map((diff) => (
        <li key={diff.field} className="text-sm">
          <span className="text-2">{diff.label}</span>
          <span className="mx-2 text-3">·</span>
          <span className="text-1">
            {diff.before === "" ? "(empty)" : plainExcerpt(diff.before, { max: 160 })}
          </span>
          <span className="mx-2 text-3">→</span>
          <span className="text-1">
            {diff.after === "" ? "(empty)" : plainExcerpt(diff.after, { max: 160 })}
          </span>
        </li>
      ))}
    </ul>
  );
}

function toSnapshot(row: {
  name: string;
  tagline: string | null;
  data: CharacterDataV2;
}): CharacterSnapshot {
  return { name: row.name, tagline: row.tagline, data: row.data };
}
