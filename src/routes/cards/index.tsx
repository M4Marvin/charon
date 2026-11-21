import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { SkeletonRows } from "@/components/common/Skeletons";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import type { CardSummary } from "@/server/cardkit";
import { listCardsFn } from "@/server/fns/cardkit";

export const Route = createFileRoute("/cards/")({
  component: CardsPage,
});

function CardsPage() {
  const { data, isLoading, error, refetch } = useQuery<CardSummary[]>({
    queryKey: ["cardkit", "list"],
    queryFn: async () => listCardsFn() as Promise<CardSummary[]>,
  });

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <PageHeader
        title="Cards"
        subtitle="Card packages on disk with their checks, renders and images."
      />

      {error ? (
        <ErrorBanner
          message={error instanceof Error ? error.message : String(error)}
          onRetry={() => void refetch()}
        />
      ) : null}
      {isLoading ? <SkeletonRows rows={4} /> : null}

      {data ? (
        <div className="mt-6 overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Card</th>
                <th className="px-4 py-3">Checks</th>
                <th className="px-4 py-3">Greetings</th>
                <th className="px-4 py-3">Images</th>
                <th className="px-4 py-3">Render</th>
              </tr>
            </thead>
            <tbody>
              {data.map((card) => (
                <tr key={card.name} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium underline-offset-4 hover:underline"
                      to="/cards/$name"
                      params={{ name: card.name }}
                    >
                      {card.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {card.ok ? (
                      <Badge variant="outline">{card.warnings} warn</Badge>
                    ) : (
                      <Badge variant="destructive">{card.errors} error</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{card.greetings}</td>
                  <td className="px-4 py-3 tabular-nums">{card.images}</td>
                  <td className="px-4 py-3 text-muted-foreground">{card.rendered ? "yes" : "—"}</td>
                </tr>
              ))}
              {!data.length ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                    No packages found under the card root.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
