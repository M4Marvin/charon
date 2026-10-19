import { useEffect } from "react";
import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function getSaveState(mutation: {
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
}): SaveState {
  if (mutation.isPending) return "saving";
  if (mutation.isError) return "error";
  if (mutation.isSuccess) return "saved";
  return "idle";
}

interface SaveStatusProps {
  state: SaveState;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}

export function SaveStatus({ state, error, onRetry, className }: SaveStatusProps) {
  useEffect(() => {
    if (state === "error") console.error("[settings] save failed", error);
  }, [state, error]);

  if (state === "idle") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn("flex min-h-4 items-center gap-1.5 text-xs", className)}
    >
      {state === "saving" ? (
        <>
          <LoaderCircle className="size-3.5 animate-spin text-2" aria-hidden="true" />
          <span className="text-2">Saving…</span>
        </>
      ) : state === "saved" ? (
        <>
          <CircleCheck className="size-3.5 text-success" aria-hidden="true" />
          <span className="text-2">Saved</span>
        </>
      ) : (
        <>
          <TriangleAlert className="size-3.5 shrink-0 text-danger" aria-hidden="true" />
          <span className="text-danger">Couldn't save. Please try again.</span>
          {onRetry ? (
            <button
              type="button"
              className="rounded px-1 font-medium text-danger underline underline-offset-2 focus-ring"
              onClick={onRetry}
            >
              Retry
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
