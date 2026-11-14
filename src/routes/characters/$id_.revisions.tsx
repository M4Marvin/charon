import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonRows } from "@/components/common/Skeletons";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { RelativeTime } from "@/components/common/RelativeTime";
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

function CharacterRevisionsPage() {
  const { id } = Route.useParams();
  const { data: character } = useCharacter(id);
  const { data: revisions, isLoading, error, refetch } = useCharacterRevisions(id);

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
          message={
            error instanceof Error
              ? `We couldn’t load this history. ${error.message}`
              : "We couldn’t load this history."
          }
          onRetry={() => void refetch()}
        />
      ) : !revisions || revisions.length === 0 ? (
        <EmptyState
          icon={History}
          title="No versions yet"
          description="Saving an edit to this character will create the first version here."
        />
      ) : (
        <RevisionList characterId={id} revisions={revisions} />
      )}
    </main>
  );
}

function RevisionList({
  characterId,
  revisions,
}: {
  characterId: string;
  revisions: RevisionSummary[];
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
}: {
  characterId: string;
  revision: RevisionSummary;
  previousRev: number | null;
  isCurrent: boolean;
}) {
  const restoreMutation = useRestoreCharacterRevision();
  const [expanded, setExpanded] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const handleRestore = () => {
    restoreMutation.mutate(
      { id: characterId, rev: revision.rev },
      {
        onSuccess: () => {
          setRestoreOpen(false);
          toast.success(`Restored version ${revision.rev}`);
        },
        onError: (err) =>
          toast.error(`Restore failed: ${err instanceof Error ? err.message : String(err)}`),
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
        description={`“${revision.name}” will replace the current character data. This save is itself recorded as a new version.`}
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
          <span className="text-1">{diff.before === "" ? "(empty)" : truncate(diff.before)}</span>
          <span className="mx-2 text-3">→</span>
          <span className="text-1">{diff.after === "" ? "(empty)" : truncate(diff.after)}</span>
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

function truncate(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
