import { useRef, useCallback } from "react";
import { ImagePlus, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface CharacterPortraitPanelProps {
  characterName: string;
  imagePath: string | null;
  isStreaming: boolean;
  onClick: () => void;
  onUpload?: (base64: string) => void;
}

export function CharacterPortraitPanel({
  characterName,
  imagePath,
  isStreaming,
  onClick,
  onUpload,
}: CharacterPortraitPanelProps) {
  const src = imagePath ? `/${imagePath}` : null;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") onUpload?.(result);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [onUpload],
  );

  return (
    <div className="flex flex-col items-center gap-3 py-4 px-0.5">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl transition-shadow",
          isStreaming
            ? "ring-2 ring-(--lagoon)/60 animate-pulse shadow-lg shadow-(--lagoon)/20"
            : "ring-1 ring-border hover:ring-2 hover:ring-(--lagoon)/30",
        )}
        aria-label={`View ${characterName} portrait`}
      >
        {src ? (
          <img
            src={src}
            alt={characterName}
            className="aspect-3/4 w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div
          className={cn(
            "flex aspect-3/4 w-full items-center justify-center bg-muted",
            src ? "hidden" : "",
          )}
        >
          <User className="size-10 text-muted-foreground/40" />
        </div>
      </button>
      <p className="text-muted-foreground text-center text-xs font-heading leading-tight">
        {characterName}
      </p>
      {onUpload && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            <ImagePlus className="size-3.5" />
            Upload image
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </>
      )}
    </div>
  );
}
