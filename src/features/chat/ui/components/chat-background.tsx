import { useState, useRef, useCallback } from "react";

interface ChatBackgroundProps {
  src: string | null;
  fallbackSrc: string | null;
}

export function ChatBackground({ src, fallbackSrc }: ChatBackgroundProps) {
  const effectiveSrc = src ?? fallbackSrc;
  const [loaded, setLoaded] = useState(false);
  const prevSrc = useRef<string | null>(effectiveSrc);

  const onLoad = useCallback(() => setLoaded(true), []);

  if (prevSrc.current !== effectiveSrc) {
    prevSrc.current = effectiveSrc;
    if (loaded) setLoaded(false);
  }

  return (
    <div className="pointer-events-none fixed inset-0 select-none">
      {effectiveSrc ? (
        <>
          {prevSrc.current && !loaded && (
            <img
              src={`/${prevSrc.current}`}
              alt=""
              className="absolute inset-0 size-full object-cover brightness-[0.8] blur-sm scale-110"
            />
          )}
          <img
            src={`/${effectiveSrc}`}
            alt=""
            onLoad={onLoad}
            className="absolute inset-0 size-full object-cover brightness-[0.8] blur-sm scale-110 transition-opacity duration-700"
            style={{ opacity: loaded ? 1 : 0 }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0 size-full"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 40%, var(--hero-a), transparent), radial-gradient(ellipse 80% 60% at 50% 70%, var(--hero-b), transparent), var(--bg-base)",
          }}
        />
      )}

      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/75 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,oklch(0.145_0_0/0.5)_100%)]" />
    </div>
  );
}
