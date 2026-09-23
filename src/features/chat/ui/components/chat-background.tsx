import { useEffect, useRef, useState } from "react";
import { OptimizedImage } from "@/components/ui/optimized-image";

interface ChatBackgroundProps {
  src: string | null;
  fallbackSrc: string | null;
}

export function ChatBackground({ src, fallbackSrc }: ChatBackgroundProps) {
  const effectiveSrc = src ?? fallbackSrc;
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [previousSrc, setPreviousSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const currentSrc = useRef(effectiveSrc);

  useEffect(() => {
    if (currentSrc.current === effectiveSrc) return;
    setPreviousSrc(currentSrc.current);
    currentSrc.current = effectiveSrc;
    setLoadedSrc(null);
    setFailedSrc(null);
  }, [effectiveSrc]);

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
          src={previousSrc}
          alt=""
          preset="background"
          intrinsicSize={false}
          className="absolute inset-0 size-full object-cover brightness-[0.8] blur-sm scale-110"
          onError={() => setFailedSrc(previousSrc)}
        />
      ) : null}

      {currentVisible && effectiveSrc ? (
        <OptimizedImage
          src={effectiveSrc}
          alt=""
          preset="background"
          intrinsicSize={false}
          priority
          onLoad={() => setLoadedSrc(effectiveSrc)}
          onError={() => setFailedSrc(effectiveSrc)}
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
