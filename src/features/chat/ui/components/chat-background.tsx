import { useState } from "react";
import { OptimizedImage } from "@/components/ui/optimized-image";

interface ChatBackgroundProps {
  src: string | null;
  fallbackSrc: string | null;
}

interface BackgroundState {
  /** The src this state was derived from. */
  seen: string | null;
  previous: string | null;
  loaded: string | null;
  failed: string | null;
}

export function ChatBackground({ src, fallbackSrc }: ChatBackgroundProps) {
  const effectiveSrc = src ?? fallbackSrc;
  // Adjusting state when the src changes: derived during render (React's
  // "you might not need an effect" pattern) so the crossfade starts with the
  // correct previous image in the same commit, with no ref and no sync pass.
  const [state, setState] = useState<BackgroundState>({
    seen: effectiveSrc,
    previous: null,
    loaded: null,
    failed: null,
  });

  let current = state;
  if (state.seen !== effectiveSrc) {
    current = { seen: effectiveSrc, previous: state.seen, loaded: null, failed: null };
    setState(current);
  }
  const { previous: previousSrc, loaded: loadedSrc, failed: failedSrc } = current;

  const currentFailed = effectiveSrc !== null && failedSrc === effectiveSrc;
  const currentVisible = effectiveSrc !== null && !currentFailed;
  const previousFailed = previousSrc !== null && failedSrc === previousSrc;
  const showPrevious =
    previousSrc !== null && previousSrc !== effectiveSrc && currentVisible && !previousFailed;
  const showFallback = !currentVisible || (!showPrevious && loadedSrc !== effectiveSrc);

  return (
    <div className="pointer-events-none fixed inset-0 select-none">
      {showPrevious && previousSrc ? (
        <OptimizedImage
          key={previousSrc}
          src={previousSrc}
          alt=""
          preset="background"
          intrinsicSize={false}
          className="absolute inset-0 size-full object-cover brightness-[0.8] blur-sm scale-110"
          onError={() =>
            setState((state) =>
              state.failed === previousSrc ? state : { ...state, failed: previousSrc },
            )
          }
        />
      ) : null}

      {currentVisible && effectiveSrc ? (
        <OptimizedImage
          key={effectiveSrc}
          src={effectiveSrc}
          alt=""
          preset="background"
          intrinsicSize={false}
          priority
          onLoad={() =>
            setState((state) =>
              state.loaded === effectiveSrc ? state : { ...state, loaded: effectiveSrc },
            )
          }
          onError={() =>
            setState((state) =>
              state.failed === effectiveSrc ? state : { ...state, failed: effectiveSrc },
            )
          }
          className="absolute inset-0 size-full object-cover brightness-[0.8] blur-sm scale-110 transition-opacity duration-700"
          style={{ opacity: loadedSrc === effectiveSrc ? 1 : 0 }}
        />
      ) : null}

      {showFallback ? (
        <div
          data-background-fallback
          className="absolute inset-0 size-full"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 40%, var(--hero-a), transparent), radial-gradient(ellipse 80% 60% at 50% 70%, var(--hero-b), transparent), var(--bg-base)",
          }}
        />
      ) : null}

      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/75 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,oklch(0.145_0_0/0.5)_100%)]" />
    </div>
  );
}
