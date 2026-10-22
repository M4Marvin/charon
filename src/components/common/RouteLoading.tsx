import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level fallback while a navigation resolves. Deliberately generic: it
 * mirrors the page shell (header + content blocks) so the transition does not
 * jump when the real page paints.
 */
export function RouteLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading page"
      className="mx-auto w-full max-w-[1200px] px-4 py-8"
    >
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-4 w-32 rounded" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}
