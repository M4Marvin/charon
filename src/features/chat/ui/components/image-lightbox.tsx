import { useState } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { cn } from "@/lib/utils";

interface ImageLightboxProps {
  src: string | null;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageLightbox({ src, alt, open, onOpenChange }: ImageLightboxProps) {
  return (
    <Dialog open={open && !!src} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 grid h-dvh w-screen max-h-none max-w-none translate-x-0 translate-y-0 place-items-center gap-0 overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-none motion-reduce:animate-none"
      >
        <DialogTitle className="sr-only">Image viewer</DialogTitle>
        {src && <LightboxBody key={src} src={src} alt={alt} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Owns the per-image viewer state (zoom, load failure). Keyed by `src` and
 * unmounted with the dialog content, so a reopened or switched image always
 * starts unzoomed and retries a previous load failure — no reset effect.
 */
function LightboxBody({
  src,
  alt,
  onOpenChange,
}: {
  src: string;
  alt: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <>
      {!failed && (
        <div className="absolute inset-0 overflow-auto overscroll-contain bg-(--bg-base)/90 backdrop-blur-md">
          <div
            className="flex min-h-full w-max min-w-full p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) onOpenChange(false);
            }}
          >
            <OptimizedImage
              src={src}
              alt={alt}
              preset="lightbox"
              sizes="100vw"
              intrinsicSize={false}
              priority
              draggable={false}
              className={cn(
                "m-auto block select-none",
                zoomed
                  ? "max-h-none max-w-none scale-150 transition-transform duration-150"
                  : "max-h-[calc(100dvh_-_2rem)] max-w-[calc(100vw_-_2rem)] object-contain",
              )}
              onError={() => setFailed(true)}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {failed && (
        <div className="flex max-w-sm flex-col items-center gap-2 rounded-xl bg-raised px-6 py-8 text-center text-2">
          <p>Image unavailable</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="absolute top-4 right-4 z-50 size-10 rounded-full glass flex items-center justify-center text-2 hover:text-1"
        aria-label="Close lightbox"
      >
        <X className="size-5" />
      </button>

      {!failed && (
        <button
          type="button"
          onClick={() => setZoomed((z) => !z)}
          aria-pressed={zoomed}
          className="absolute bottom-4 right-4 z-50 size-10 rounded-full glass flex items-center justify-center text-2 hover:text-1"
          aria-label={zoomed ? "Fit to screen" : "Zoom in"}
        >
          {zoomed ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
        </button>
      )}
    </>
  );
}
