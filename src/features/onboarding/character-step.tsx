import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fileToBase64, useImportCharacter } from "@/hooks/useCharacters";
import { previewCharacter } from "@/server/fns/characters";
import { MAX_IMAGE_UPLOAD_BYTES } from "@/lib/image-optimization";

export function CharacterStep({
  hasCharacter,
  onImported,
}: {
  hasCharacter: boolean;
  onImported: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const importMutation = useImportCharacter();

  const handleFile = async (f: File | null) => {
    if (!f || processing) return;
    setError(null);
    if (f.type !== "" && f.type !== "image/png") {
      setError("Only PNG files are supported.");
      return;
    }
    if (f.size > MAX_IMAGE_UPLOAD_BYTES) {
      setError("File too large (max 50 MB).");
      return;
    }
    setProcessing(true);
    try {
      const b64 = await fileToBase64(f);
      const preview = await previewCharacter({ data: { pngBase64: b64 } });
      if (!preview.ok) {
        setError(
          preview.error.kind === "validation"
            ? preview.error.errors.map((e) => e.message).join(" ")
            : preview.error.message,
        );
        return;
      }
      const res = await importMutation.mutateAsync({ pngBase64: b64 });
      if (res.ok) {
        toast.success(`Imported ${res.character.name}`);
        onImported();
      } else if (res.error.kind === "validation") {
        setError(res.error.errors.map((e) => e.message).join(" "));
      } else {
        setError(res.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-4">
      {hasCharacter ? (
        <p className="text-sm text-2">
          You already have characters ready to chat with. You can import your own anytime.
        </p>
      ) : (
        <p className="text-sm text-2">
          You need at least one character to start a chat. Import one now.
        </p>
      )}

      <div className="grid gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={processing || importMutation.isPending}
        >
          {processing || importMutation.isPending ? "Importing..." : "Import a character (PNG)"}
        </Button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </div>
  );
}
