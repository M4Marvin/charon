import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { BookOpen, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { ImportLorebookDialog } from "@/components/lorebook/ImportLorebookDialog";
import { useLorebooks, useToggleLorebook } from "@/hooks/useLorebooks";
import { SkeletonRows } from "@/components/common/Skeletons";

export const Route = createFileRoute("/lorebooks/")({
  component: LorebooksPage,
});

function LorebooksPage() {
  const { data, isLoading, error, refetch } = useLorebooks();
  const toggleMutation = useToggleLorebook();
  const [importOpen, setImportOpen] = useState(false);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader
          title="Lorebooks"
          subtitle="Manage lorebooks and their keyword-triggered entries."
        />
        <SkeletonRows rows={3} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader
          title="Lorebooks"
          subtitle="Manage lorebooks and their keyword-triggered entries."
        />
        <ErrorBanner
          message={
            error instanceof Error
              ? `We couldn’t load your lorebooks. ${error.message}`
              : "We couldn’t load your lorebooks."
          }
          onRetry={() => void refetch()}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <PageHeader
        title="Lorebooks"
        subtitle="Manage lorebooks and their keyword-triggered entries."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              Import
            </Button>
            <Button asChild>
              <Link to="/lorebooks/new">New Lorebook</Link>
            </Button>
          </div>
        }
      />

      {data && data.length > 0 ? (
        <div className="space-y-1">
          {data.map((lb) => (
            <div
              key={lb.id}
              className="group relative flex min-h-16 items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-surface"
            >
              <Link
                to="/lorebooks/$id"
                params={{ id: lb.id }}
                aria-label={`Open ${lb.name}`}
                className="absolute inset-0 z-10 rounded-xl"
              />
              <Switch
                checked={lb.enabled}
                disabled={toggleMutation.isPending}
                onCheckedChange={(checked) =>
                  toggleMutation.mutate(
                    { lorebookId: lb.id, enabled: checked },
                    {
                      onError: (err) =>
                        toast.error(
                          `Couldn’t update this lorebook: ${err instanceof Error ? err.message : String(err)}`,
                        ),
                    },
                  )
                }
                className="relative z-20"
                aria-label={`Toggle ${lb.name}`}
              />
              <div className="pointer-events-none relative z-0 min-w-0 flex-1">
                <p className="text-headline truncate">{lb.name}</p>
                {lb.description ? (
                  <p className="text-2 text-sm line-clamp-1">{lb.description}</p>
                ) : null}
              </div>
              <Badge variant="secondary" className="pointer-events-none relative z-0 shrink-0">
                {lb.entryCount} {lb.entryCount === 1 ? "entry" : "entries"}
              </Badge>
              <ChevronRight className="pointer-events-none relative z-0 size-4 shrink-0 text-2" />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No lorebooks yet"
          description="Create one to start adding keyword-triggered entries."
        >
          <Button asChild>
            <Link to="/lorebooks/new">New Lorebook</Link>
          </Button>
        </EmptyState>
      )}

      <ImportLorebookDialog open={importOpen} onOpenChange={setImportOpen} />
    </main>
  );
}
