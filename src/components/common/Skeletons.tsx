import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonRows({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function SkeletonCardGrid({ count, lanes = 3 }: { count: number; lanes?: number }) {
  const colsClass =
    {
      2: "grid-cols-2",
      3: "grid-cols-2 sm:grid-cols-3",
      4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
      5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
    }[lanes] ?? "grid-cols-2 sm:grid-cols-3";

  return (
    <div className={`grid gap-3 ${colsClass}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
      ))}
    </div>
  );
}

export function SkeletonForm() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-4">
          <Skeleton className="h-6 w-32 rounded" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
