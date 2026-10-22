import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { cn } from "@/lib/utils";

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
  const [keepImageMounted, setKeepImageMounted] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    setImageFailed(false);
    if (open) {
      setKeepImageMounted(true);
      return;
    }

    const timer = window.setTimeout(() => setKeepImageMounted(false), 300);
    return () => window.clearTimeout(timer);
  }, [open, imageSrc]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
      onCloseRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const canOpen = imageSrc !== null && !imageFailed;
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
      <div
        className={cn(
          "glass-strong rounded-2xl overflow-hidden shadow-xl ring-1 ring-(--border-subtle) w-full xl:w-[min(24rem,max(12rem,calc((100vw_-_48rem)/2_-_2rem)))]",
          canOpen && "cursor-pointer group focus-ring",
        )}
        onClick={canOpen ? onImageClick : undefined}
        role={canOpen ? "button" : undefined}
        tabIndex={canOpen ? 0 : -1}
        aria-label={canOpen ? `View ${name} portrait` : undefined}
        onKeyDown={(e) => {
          if (!canOpen) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onImageClick();
          }
        }}
      >
        <div className="aspect-[3/4] max-h-[70dvh] relative flex items-center justify-center bg-(--bg-base)/60">
          {shouldMountImage && imageSrc && !imageFailed ? (
            <OptimizedImage
              key={imageSrc}
              src={imageSrc}
              alt={`${name} portrait`}
              preset="portrait"
              sizes={PANEL_SIZES}
              priority={open}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
              onError={() => setImageFailed(true)}
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
      </div>

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
