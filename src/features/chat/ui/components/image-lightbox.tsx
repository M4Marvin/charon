import { useState, useCallback } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ImageLightboxProps {
  src: string | null;
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageLightbox({
  src,
  alt,
  open,
  onOpenChange,
}: ImageLightboxProps) {
  const [zoomed, setZoomed] = useState(false);

  const toggleZoom = useCallback(() => {
    setZoomed((z) => !z);
  }, []);

  return (
    <Dialog open={open && !!src} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none max-h-none size-full border-0 bg-transparent p-0 shadow-none translate-x-0 translate-y-0 left-0 top-0"
      >
        <DialogTitle className="sr-only">Image viewer</DialogTitle>
        {src && (
          <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md"
            onClick={() => onOpenChange(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
              }}
              className="absolute top-4 right-4 z-10 size-10 rounded-full glass flex items-center justify-center text-white/70 hover:text-white"
              aria-label="Close lightbox"
            >
              <X className="size-5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleZoom();
              }}
              className="absolute bottom-4 right-4 z-10 size-10 rounded-full glass flex items-center justify-center text-white/70 hover:text-white"
              aria-label={zoomed ? "Fit to screen" : "Zoom in"}
            >
              {zoomed ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
            </button>

            <img
              src={src}
              alt={alt ?? ""}
              onClick={(e) => {
                e.stopPropagation();
                toggleZoom();
              }}
              className={cn(
                "select-none transition-transform duration-200",
                zoomed
                  ? "max-w-none max-h-none scale-150 cursor-zoom-out"
                  : "max-h-[88vh] max-w-[92vw] object-contain cursor-zoom-in",
              )}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
