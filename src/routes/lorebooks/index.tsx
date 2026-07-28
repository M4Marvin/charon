import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { ImportLorebookDialog } from "@/components/lorebook/ImportLorebookDialog";
import { useLorebooks, useToggleLorebook } from "@/hooks/useLorebooks";

export const Route = createFileRoute("/lorebooks/")({
  component: LorebooksPage,
});

function LorebooksPage() {
  const { data, isLoading, error } = useLorebooks();
  const toggleMutation = useToggleLorebook();
  const [importOpen, setImportOpen] = useState(false);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader
          title="Lorebooks"
          subtitle="Manage lorebooks and their keyword-triggered entries."
        />
        <div className="space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="Lorebooks" />
        <ErrorBanner message={(error as Error).message ?? "Failed to load lorebooks"} />
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
            <Link
              key={lb.id}
              to="/lorebooks/$id"
              params={{ id: lb.id }}
              className="flex items-center gap-4 rounded-xl px-4 py-3 hover:bg-surface transition-colors no-underline group min-h-16"
            >
              <Switch
                checked={lb.enabled}
                disabled={toggleMutation.isPending}
                onCheckedChange={(checked) =>
                  toggleMutation.mutate({ lorebookId: lb.id, enabled: checked })
                }
                onClick={(e) => e.stopPropagation()}
                aria-label={`Toggle ${lb.name}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-headline truncate">{lb.name}</p>
                {lb.description ? (
                  <p className="text-2 text-sm line-clamp-1">{lb.description}</p>
                ) : null}
              </div>
              <Badge variant="secondary" className="shrink-0">
                {lb.entryCount} {lb.entryCount === 1 ? "entry" : "entries"}
              </Badge>
              <ChevronRight className="size-4 text-3 shrink-0" />
            </Link>
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
