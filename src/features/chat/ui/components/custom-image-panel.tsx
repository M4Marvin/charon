import { X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CustomImagePanelProps {
  open: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onImageClick: () => void;
}

export function CustomImagePanel({
  open,
  imageSrc,
  onClose,
  onImageClick,
}: CustomImagePanelProps) {
  return (
    <div
      className={cn(
        "fixed right-4 top-1/2 -translate-y-1/2 z-20 hidden lg:flex flex-col gap-2 transition-all duration-300",
        open ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+2rem)] opacity-0",
      )}
    >
      <div
        className="glass-strong rounded-2xl overflow-hidden w-48 shadow-xl cursor-pointer group"
        onClick={imageSrc ? onImageClick : undefined}
        role="button"
        tabIndex={imageSrc ? 0 : -1}
        aria-label={imageSrc ? "View scene image" : "No scene set"}
        onKeyDown={(e) => e.key === "Enter" && imageSrc && onImageClick()}
      >
        <div className="aspect-video relative flex items-center justify-center bg-[--bg-base]/60">
          {imageSrc ? (
            <img
              src={`/${imageSrc}`}
              alt="Scene"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-[--sea-ink-soft]">
              <ImageIcon className="size-6 opacity-40" />
              <span className="text-xs">No scene set</span>
            </div>
          )}
        </div>
        <div className="px-3 py-2.5">
          <p className="text-xs text-[--sea-ink-soft]">Scene</p>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-full glass self-start text-white/60 hover:text-white -mt-1"
        onClick={onClose}
        aria-label="Close scene panel"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
