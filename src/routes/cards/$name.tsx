import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { SkeletonRows } from "@/components/common/Skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CardDetail } from "@/server/cardkit";
import { cardDetailFn, renderCardFn } from "@/server/fns/cardkit";

export const Route = createFileRoute("/cards/$name")({
  component: CardPage,
});

type Shot = { src: string; label: string };

function Lightbox({
  shots,
  index,
  onIndex,
  onClose,
}: {
  shots: Shot[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const shot = shots[index];
  const step = (delta: number) => onIndex((index + delta + shots.length) % shots.length);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-fit min-w-0 max-w-[96vw] overflow-visible border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-none"
      >
        <div className="relative flex flex-col items-center gap-3">
          <img
            src={shot.src}
            alt=""
            className="max-h-[82vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
          />
          <div className="flex items-center gap-4 rounded-full bg-black/70 px-4 py-2 text-xs text-white backdrop-blur">
            <span className="font-medium">{shot.label}</span>
            <span className="tabular-nums text-white/60">
              {index + 1} / {shots.length}
            </span>
            <a
              href={shot.src}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-white/80 hover:text-white"
            >
              open <ExternalLink className="size-3" />
            </a>
          </div>
          {shots.length > 1 ? (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-1/2 -left-4 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100"
                onClick={() => step(-1)}
                aria-label="Previous image"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-1/2 -right-4 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100"
                onClick={() => step(1)}
                aria-label="Next image"
              >
                <ChevronRight />
              </Button>
            </>
          ) : null}
          <Button
            variant="secondary"
            size="icon"
            className="absolute -top-3 -right-3 rounded-full"
            onClick={onClose}
            aria-label="Close"
          >
            <X />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CardPage() {
  const { name } = Route.useParams();
  const queryClient = useQueryClient();
  const detailFn = useServerFn(cardDetailFn);
  const renderFn = useServerFn(renderCardFn);
  const [viewer, setViewer] = useState<number | null>(null);

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

  const shots: Shot[] =
    data?.greetings.flatMap((greeting) => {
      const id = greeting.id.replace(/^greetings\//, "").replace(/\.md$/, "");
      return greeting.images.map((src, index) => ({
        src,
        label: greeting.images.length > 1 ? `${id} #${index + 1}` : id,
      }));
    }) ?? [];

  const images = data?.check.stats.images ?? 0;
  const cssKb = data ? Math.round(data.check.stats.cssBytes / 1024) : 0;

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <PageHeader
        title={data?.name ?? name}
        subtitle={data?.dir}
        backTo="/cards"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => render.mutate()} disabled={render.isPending}>
              {render.isPending ? "Rendering…" : "Re-render"}
            </Button>
            {data?.renders?.html ? (
              <Button asChild variant="outline">
                <a href={data.renders.html} target="_blank" rel="noreferrer">
                  Page HTML
                </a>
              </Button>
            ) : null}
            {data?.renders?.report ? (
              <Button asChild variant="outline">
                <a href={data.renders.report} target="_blank" rel="noreferrer">
                  Report
                </a>
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <ErrorBanner
          message={error instanceof Error ? error.message : String(error)}
          onRetry={() => void refetch()}
        />
      ) : null}
      {isLoading ? <SkeletonRows rows={4} /> : null}

      {data ? (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {data.ok ? (
              <Badge variant="outline">Clean</Badge>
            ) : (
              <Badge variant="destructive">
                {data.errors} {data.errors === 1 ? "error" : "errors"}
              </Badge>
            )}
            <span>{data.greetingCount} greetings</span>
            <span aria-hidden>·</span>
            <span>
              {images} images, {cssKb} KB CSS
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-8">
              <section>
                <h2 className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Renders
                </h2>
                {data.renders ? (
                  <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
                    {[
                      { key: "desktop", label: "desktop · 1280" },
                      { key: "mobile", label: "mobile · 390" },
                    ].map(({ key, label }) => (
                      <figure key={key} className="overflow-hidden rounded-xl border bg-muted/20">
                        <a
                          href={data.renders![key as "desktop" | "mobile"]}
                          target="_blank"
                          rel="noreferrer"
                          className="block max-h-[560px] overflow-y-auto overscroll-contain"
                        >
                          <img
                            src={data.renders![key as "desktop" | "mobile"]}
                            alt={`${key} render`}
                            className="w-full"
                          />
                        </a>
                        <figcaption className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
                          {label}
                          <ExternalLink className="size-3.5" />
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No render.
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    Greeting images
                  </h2>
                  <span className="text-xs text-muted-foreground tabular-nums">{shots.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                  {shots.map((shot, index) => (
                    <button
                      key={`${shot.src}-${index}`}
                      type="button"
                      className="group relative aspect-[3/2] overflow-hidden rounded-lg border bg-muted/20"
                      onClick={() => setViewer(index)}
                    >
                      <img
                        src={shot.src}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-6 pb-1.5 text-[11px] font-medium text-white">
                        <span>{shot.label}</span>
                        <span className="text-white/60 tabular-nums">{index + 1}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-6 self-start lg:sticky lg:top-6">
              <section className="rounded-xl border p-4">
                <h2 className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Checks
                </h2>
                {data.issues.length ? (
                  <ul className="space-y-2">
                    {data.issues.map((issue, index) => (
                      <li
                        key={`${issue.code}-${index}`}
                        className={cn(
                          "rounded-md border-l-2 bg-muted/40 px-3 py-2 text-sm",
                          issue.level === "error" ? "border-destructive" : "border-amber-500",
                        )}
                      >
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {issue.code}
                        </span>
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Clean.</p>
                )}
              </section>

              <section className="rounded-xl border p-4">
                <h2 className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Package
                </h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Greetings</dt>
                    <dd className="tabular-nums">{data.greetingCount}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Images</dt>
                    <dd className="tabular-nums">{images}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">CSS</dt>
                    <dd className="tabular-nums">{cssKb} KB</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Checks</dt>
                    <dd className="tabular-nums">
                      {data.errors} errors · {data.warnings} warnings
                    </dd>
                  </div>
                </dl>
              </section>
            </aside>
          </div>
        </>
      ) : null}

      {data && viewer !== null && shots[viewer] ? (
        <Lightbox
          shots={shots}
          index={viewer}
          onIndex={setViewer}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </main>
  );
}
