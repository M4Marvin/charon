import { useRef, useCallback } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomImagePanelProps {
  imageBase64: string | null;
  onUpload: (base64: string) => void;
  onRemove: () => void;
  onClick: () => void;
}

export function CustomImagePanel({
  imageBase64,
  onUpload,
  onRemove,
  onClick,
}: CustomImagePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") onUpload(result);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [onUpload],
  );

  return (
    <div className="flex flex-col items-center gap-3 px-2 py-4">
      {imageBase64 ? (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={onClick}
            className="overflow-hidden rounded-xl ring-1 ring-border hover:ring-2 hover:ring-[var(--lagoon)]/30 transition-shadow"
            aria-label="View custom image"
          >
            <img
              src={imageBase64}
              alt="Custom image"
              className="aspect-[3/4] w-full object-cover"
            />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm hover:bg-destructive/90"
            aria-label="Remove custom image"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex aspect-[3/4] w-full shrink-0 flex-col items-center justify-center gap-2",
            "rounded-xl border-2 border-dashed border-white/15",
            "text-white/50 hover:border-[var(--lagoon)]/40 hover:text-[var(--lagoon-deep)]",
            "transition-colors",
          )}
          aria-label="Upload custom image"
        >
          <ImagePlus className="size-8" />
          <span className="text-[11px] font-medium">Upload image</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />

      {imageBase64 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-muted-foreground hover:text-foreground text-xs transition-colors"
        >
          Change image
        </button>
      )}
    </div>
  );
}
