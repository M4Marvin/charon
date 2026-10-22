import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Fades the routed content in on pathname changes. The wrapper is keyed on the
 * pathname (not search) so filters and tabs keep their local state. The
 * immersive chat is excluded: animating its container interferes with scroll
 * anchoring.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const immersive = pathname.startsWith("/chat/") || pathname === "/onboarding";

  if (immersive) return <>{children}</>;

  return (
    <div key={pathname} className={cn("page-transition min-h-0")}>
      {children}
    </div>
  );
}

/** A slim indeterminate bar while a route is loading. */
export function RouteProgress() {
  const isLoading = useRouterState({ select: (state) => state.isLoading });

  return (
    <div
      aria-hidden="true"
      className={cn(
        "route-progress pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 origin-left bg-brand",
        isLoading ? "route-progress-active" : "opacity-0",
      )}
    />
  );
}
