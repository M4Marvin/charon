import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CircleCheck, LoaderCircle, RotateCw, TriangleAlert } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface MutationLike {
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
}

export function getSaveState(mutation: MutationLike): SaveState {
  if (mutation.isPending) return "saving";
  if (mutation.isError) return "error";
  if (mutation.isSuccess) return "saved";
  return "idle";
}

interface SaveStatus {
  state: SaveState;
  source: string;
  error?: unknown;
  retry?: () => void;
  at?: number;
}

interface SaveActions {
  activeSection: string;
  report: (status: SaveStatus) => void;
  clear: (source: string) => void;
}

const SaveActionsContext = createContext<SaveActions | null>(null);
const SaveStatusContext = createContext<SaveStatus>({ state: "idle", source: "" });

const SAVED_VISIBLE_MS = 2400;
/** A success older than this is stale (e.g. re-entering a section); don't replay it. */
const SAVED_FRESH_MS = 5000;

/**
 * Owns the single save-status surface for the whole panel. Sections report their
 * mutation state here; the footer renders it. Kept separate from per-field UI so
 * there is exactly one live region and one place where "Saved" can decay.
 */
export function SettingsSaveProvider({
  activeSection,
  children,
}: {
  activeSection: string;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<SaveStatus>({ state: "idle", source: activeSection });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoggedRef = useRef<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const report = useCallback(
    (next: SaveStatus) => {
      if (next.state === "idle") return;
      clearTimer();

      if (next.state === "error") {
        const logKey = `${next.source}:${next.at ?? 0}`;
        if (lastLoggedRef.current !== logKey) {
          lastLoggedRef.current = logKey;
          console.error("[settings] save failed", next.error);
        }
        setStatus(next);
        return;
      }

      setStatus(next);
      if (next.state === "saved") {
        timerRef.current = setTimeout(() => {
          setStatus((current) =>
            current.source === next.source && current.state === "saved"
              ? { state: "idle", source: next.source }
              : current,
          );
        }, SAVED_VISIBLE_MS);
      }
    },
    [clearTimer],
  );

  const clear = useCallback((source: string) => {
    setStatus((current) =>
      current.source === source && current.state !== "idle" ? { state: "idle", source } : current,
    );
  }, []);

  const actions = useMemo(() => ({ activeSection, report, clear }), [activeSection, report, clear]);
  // A status from the previous section must never leak into the new one. Deriving
  // the visible status avoids a reset effect that could wipe a fresh report.
  const visibleStatus =
    status.source === activeSection ? status : { state: "idle" as const, source: activeSection };

  return (
    <SaveActionsContext.Provider value={actions}>
      <SaveStatusContext.Provider value={visibleStatus}>{children}</SaveStatusContext.Provider>
    </SaveActionsContext.Provider>
  );
}

/**
 * Report a section's save state. No-op outside the settings sheet (e.g. the
 * Preferences page), and ignored while another section is active.
 */
export function useSettingsSaveStatus(
  source: string,
  state: SaveState,
  options?: { retry?: () => void; at?: number; error?: unknown },
) {
  const actions = useContext(SaveActionsContext);
  const active = actions?.activeSection === source;
  const retryRef = useRef(options?.retry);
  retryRef.current = options?.retry;

  const at = options?.at;
  const error = options?.error;

  useEffect(() => {
    if (!actions || !active) return;
    if (state === "idle") {
      actions.clear(source);
      return;
    }
    if (state === "saved" && at !== undefined && at > 0 && Date.now() - at > SAVED_FRESH_MS) {
      actions.clear(source);
      return;
    }
    actions.report({ state, source, retry: retryRef.current, at, error });
  }, [actions, active, state, at, source, error]);
}

/**
 * The panel's only save indicator. Rendered inside the footer so it is visible
 * while any field is being edited; `Saved` fades after a short hold.
 */
export function SettingsSaveStatus() {
  const status = useContext(SaveStatusContext);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="settings-save-status flex min-h-5 min-w-0 items-center gap-1.5 text-[13px]"
      data-state={status.state}
    >
      {status.state === "saving" ? (
        <>
          <LoaderCircle className="size-3.5 shrink-0 animate-spin text-2" aria-hidden="true" />
          <span className="truncate text-2">Saving…</span>
        </>
      ) : status.state === "saved" ? (
        <>
          <CircleCheck className="size-3.5 shrink-0 text-success" aria-hidden="true" />
          <span className="truncate text-2">Saved</span>
        </>
      ) : status.state === "error" ? (
        <>
          <TriangleAlert className="size-3.5 shrink-0 text-danger" aria-hidden="true" />
          <span className="truncate text-danger">Couldn't save.</span>
          {status.retry ? (
            <button
              type="button"
              className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-danger underline underline-offset-2 transition-colors hover:bg-danger/10 focus-ring"
              onClick={status.retry}
            >
              <RotateCw className="size-3" aria-hidden="true" />
              Retry
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
