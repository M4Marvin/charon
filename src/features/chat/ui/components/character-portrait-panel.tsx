import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UploadedImage } from "@/components/ui/uploaded-image";

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
  return (
    <div
      className={cn(
        "fixed left-4 top-1/2 -translate-y-1/2 z-20 hidden lg:flex flex-col gap-2 transition-all duration-300",
        open ? "translate-x-0 opacity-100" : "-translate-x-[calc(100%+2rem)] opacity-0",
      )}
    >
      <div
        className="glass-strong rounded-2xl overflow-hidden w-[max(12rem,calc((100vw-48rem)/2-2rem))] shadow-xl cursor-pointer group"
        onClick={onImageClick}
        role="button"
        tabIndex={0}
        aria-label={`View ${name} portrait`}
        onKeyDown={(e) => e.key === "Enter" && onImageClick()}
      >
        <div className="aspect-[3/4] max-h-[70dvh] relative flex items-center justify-center bg-[--bg-base]/60">
          {imageSrc ? (
            <UploadedImage
              storedPath={imageSrc}
              alt={name}
              width={600}
              height={800}
              layout="constrained"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="text-[--sea-ink-soft] text-sm">No portrait</div>
          )}
          {isStreaming && (
            <div className="absolute inset-0 ring-2 ring-[--lagoon]/40 rounded-2xl animate-pulse pointer-events-none" />
          )}
        </div>
        <div className="px-3 py-2.5 flex items-center justify-between">
          <p className="font-heading text-sm text-[--sea-ink] truncate">{name}</p>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-full glass self-end text-white/60 hover:text-white -mt-1"
        onClick={onClose}
        aria-label="Close portrait panel"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
