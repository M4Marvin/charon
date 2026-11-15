import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { cn } from "@/lib/utils";
import { useFloatingPanel } from "../hooks/use-floating-panel";

const PANEL_SIZES = "min(24rem, max(12rem, calc((100vw - 48rem)/2 - 2rem)))";

interface CharacterPortraitPanelProps {
  open: boolean;
  name: string;
  imageSrc: string | null;
  isStreaming: boolean;
  onClose: () => void;
  onImageClick: () => void;
}

export function CharacterPortraitPanel({
  open,
  name,
  imageSrc,
  isStreaming,
  onClose,
  onImageClick,
}: CharacterPortraitPanelProps) {
  // Failure is keyed by src (CONTRIBUTING fallback pattern): a new version
  // recovers without a reset effect; the effect below still resets it on
  // reopen so a previously failed load is retried.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { keepImageMounted } = useFloatingPanel({
    open,
    onClose,
    focusRef: closeButtonRef,
  });

  useEffect(() => {
    setFailedSrc(null);
  }, [open, imageSrc]);

  const canOpen = imageSrc !== null && failedSrc !== imageSrc;
  const shouldMountImage = open || keepImageMounted;

  return (
    <div
      id="character-portrait-panel"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "fixed z-30 flex flex-col gap-2 transition-[transform,opacity] duration-200 max-xl:inset-x-3 max-xl:bottom-20 max-xl:top-auto xl:top-1/2 xl:-translate-y-1/2 xl:left-4",
        open
          ? "pointer-events-auto translate-x-0 translate-y-0 opacity-100"
          : "pointer-events-none opacity-0 max-xl:translate-y-4 xl:-translate-x-[calc(100%_+_2rem)]",
      )}
    >
      {/* A real button: role, focus, and Enter/Space activation are native. */}
      <button
        type="button"
        disabled={!canOpen}
        onClick={onImageClick}
        className={cn(
          "block w-full text-left glass-strong rounded-2xl overflow-hidden shadow-xl ring-1 ring-(--border-subtle) xl:w-[min(24rem,max(12rem,calc((100vw_-_48rem)/2_-_2rem)))]",
          canOpen && "cursor-pointer group focus-ring",
        )}
        aria-label={canOpen ? `View ${name} portrait` : undefined}
      >
        <div className="aspect-[3/4] max-h-[70dvh] relative flex items-center justify-center bg-(--bg-base)/60">
          {shouldMountImage && imageSrc && failedSrc !== imageSrc ? (
            <OptimizedImage
              key={imageSrc}
              src={imageSrc}
              alt={`${name} portrait`}
              preset="portrait"
              sizes={PANEL_SIZES}
              priority={open}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
              onError={() => setFailedSrc(imageSrc)}
            />
          ) : (
            <div className="text-(--sea-ink-soft) text-sm">No portrait</div>
          )}
          {isStreaming && (
            <div className="absolute inset-0 ring-2 ring-(--lagoon)/40 rounded-2xl animate-pulse pointer-events-none motion-reduce:animate-none" />
          )}
        </div>
        <div className="px-3 py-2.5 flex items-center justify-between">
          <p className="font-heading text-sm text-(--sea-ink) truncate">{name}</p>
        </div>
      </button>

      <Button
        ref={closeButtonRef}
        variant="ghost"
        size="icon"
        className="size-8 rounded-full glass self-end text-2 hover:text-1 -mt-1"
        onClick={onClose}
        aria-label="Close portrait panel"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
