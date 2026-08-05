import { useRef, useCallback } from "react";
import { X, ImageIcon, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CustomImagePanelProps {
  open: boolean;
  imageSrc: string | null;
  customImageSrc: string | null;
  onClose: () => void;
  onImageClick: () => void;
  onUploadImage: (file: File) => void;
  onClearImage: () => void;
}

export function CustomImagePanel({
  open,
  imageSrc,
  customImageSrc,
  onClose,
  onImageClick,
  onUploadImage,
  onClearImage,
}: CustomImagePanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onUploadImage(file);
        e.target.value = "";
      }
    },
    [onUploadImage],
  );

  const displaySrc = customImageSrc ?? imageSrc;
  const isCustom = customImageSrc !== null;
  const hasImage = displaySrc !== null;
  const label = isCustom ? "Custom" : "Scene";

  return (
    <div
      className={cn(
        "fixed right-4 top-1/2 -translate-y-1/2 z-20 hidden lg:flex flex-col gap-2 transition-all duration-300",
        open ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+2rem)] opacity-0",
      )}
    >
      <div
        className="glass-strong rounded-2xl overflow-hidden w-[max(12rem,calc((100vw-48rem)/2-2rem))] shadow-xl cursor-pointer group"
        onClick={hasImage ? onImageClick : undefined}
        role="button"
        tabIndex={hasImage ? 0 : -1}
        aria-label={hasImage ? `View ${label.toLowerCase()} image` : "No image set"}
        onKeyDown={(e) => e.key === "Enter" && hasImage && onImageClick()}
      >
        <div className="relative flex items-center justify-center bg-(--bg-base)/60">
          {hasImage ? (
            <img
              src={displaySrc}
              alt={label}
              className="w-full h-auto block transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-(--sea-ink-soft) py-10 w-full">
              <ImageIcon className="size-6 opacity-40" />
              <span className="text-xs">No scene set</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 self-start -mt-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full glass text-white/60 hover:text-white"
          onClick={() => fileRef.current?.click()}
          aria-label="Upload custom image"
        >
          <ImagePlus className="size-3.5" />
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          aria-label="Upload custom image file"
        />
        {isCustom && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full glass text-white/60 hover:text-white"
            onClick={onClearImage}
            aria-label="Clear custom image"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full glass text-white/60 hover:text-white"
          onClick={onClose}
          aria-label="Close scene panel"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
