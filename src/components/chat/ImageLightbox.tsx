import { X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ImageLightboxProps {
  src: string | null;
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageLightbox({ src, alt, open, onOpenChange }: ImageLightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "max-h-[90vh] max-w-[90vw] border-0 bg-transparent p-0 shadow-none",
          !src && "hidden",
        )}
      >
        {src && (
          <div className="relative">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute -right-2 -top-2 z-10 rounded-full bg-black/60 p-1 text-white/80 hover:bg-black/80 hover:text-white"
              aria-label="Close lightbox"
            >
              <X className="size-5" />
            </button>
            <img
              src={src}
              alt={alt ?? ""}
              className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
