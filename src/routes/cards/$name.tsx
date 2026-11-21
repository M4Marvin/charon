import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { SkeletonRows } from "@/components/common/Skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CardDetail } from "@/server/cardkit";
import { cardDetailFn, renderCardFn } from "@/server/fns/cardkit";

export const Route = createFileRoute("/cards/$name")({
  component: CardPage,
});

function CardPage() {
  const { name } = Route.useParams();
  const queryClient = useQueryClient();
  const detailFn = useServerFn(cardDetailFn);
  const renderFn = useServerFn(renderCardFn);
  const [tab, setTab] = useState<"desktop" | "mobile">("desktop");

  const { data, isLoading, error, refetch } = useQuery<CardDetail>({
    queryKey: ["cardkit", name],
    queryFn: async () => detailFn({ data: { name } }) as Promise<CardDetail>,
  });

  const render = useMutation({
    mutationFn: () => renderFn({ data: { name } }),
    onSuccess: (path) => {
      toast.success(`report written to ${path}`);
      void queryClient.invalidateQueries({ queryKey: ["cardkit", name] });
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : String(cause)),
  });

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8">
      <PageHeader
        title={data?.name ?? name}
        subtitle={data?.dir}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => render.mutate()} disabled={render.isPending}>
              {render.isPending ? "Rendering…" : "Re-render"}
            </Button>
            {data?.renders?.html ? (
              <Button asChild variant="outline">
                <a href={data.renders.html} target="_blank" rel="noreferrer">
                  Open page
                </a>
              </Button>
            ) : null}
            <Button asChild variant="ghost">
              <Link to="/cards">All cards</Link>
            </Button>
          </div>
        }
      />

      {error ? (
        <ErrorBanner
          message={error instanceof Error ? error.message : String(error)}
          onRetry={() => void refetch()}
        />
      ) : null}
      {isLoading ? <SkeletonRows rows={3} /> : null}

      {data ? (
        <div className="mt-2 space-y-8">
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Checks
            </h2>
            {data.issues.length ? (
              <ul className="space-y-2">
                {data.issues.map((issue, index) => (
                  <li
                    key={`${issue.code}-${index}`}
                    className={
                      issue.level === "error"
                        ? "border-l-2 border-destructive bg-muted/40 px-3 py-2 text-sm"
                        : "border-l-2 border-amber-500 bg-muted/40 px-3 py-2 text-sm"
                    }
                  >
                    <span className="font-mono text-xs text-muted-foreground">{issue.code}</span>{" "}
                    {issue.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No issues.</p>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Render
              </h2>
              <div className="flex gap-1">
                {(["desktop", "mobile"] as const).map((key) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={tab === key ? "secondary" : "ghost"}
                    onClick={() => setTab(key)}
                  >
                    {key}
                  </Button>
                ))}
              </div>
            </div>
            {data.renders ? (
              <a href={data.renders[tab]} target="_blank" rel="noreferrer" className="block">
                <img
                  src={data.renders[tab]}
                  alt={`${data.name} ${tab} render`}
                  className={
                    tab === "mobile"
                      ? "mx-auto max-h-[900px] w-auto rounded-lg border"
                      : "w-full rounded-lg border"
                  }
                />
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">Not rendered yet — press Re-render.</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Greetings ({data.greetingCount})
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {data.greetings.map((greeting) => (
                <article key={greeting.id} className="rounded-lg border p-4">
                  <header className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium">{greeting.id}</span>
                    <span className="text-xs text-muted-foreground">{greeting.length} chars</span>
                  </header>
                  <div className="grid grid-cols-2 gap-2">
                    {greeting.images.map((src, index) => (
                      <a key={`${src}-${index}`} href={src} target="_blank" rel="noreferrer">
                        <img
                          src={src}
                          alt=""
                          className="h-28 w-full rounded border object-cover"
                          loading="lazy"
                        />
                      </a>
                    ))}
                    {!greeting.images.length ? (
                      <span className="text-xs text-destructive">no image</span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Live state
            </h2>
            {data.live ? (
              <div className="rounded-lg border p-4">
                <p className="mb-2 text-sm">
                  <Badge variant="outline">synced {data.live.syncedAt}</Badge>
                </p>
                <pre className="max-h-[420px] overflow-auto rounded bg-muted/40 p-3 text-xs">
                  {data.live.raw}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No <code className="font-mono text-xs">live.json</code> in this package yet. A sync
                through the browser writes one.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
