import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Upload, ArrowLeft, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { authClient } from "@/lib/auth-client";
import { fileToBase64, useImportCharacter } from "@/hooks/useCharacters";
import { previewCharacter } from "@/server/fns/characters";
import type { PreviewResult } from "@/server/fns/characters";

export const Route = createFileRoute("/characters/new")({
  component: NewCharacterPage,
});

function NewCharacterPage() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const isDemo = session?.user?.role !== "admin";

  useEffect(() => {
    if (session && isDemo) void navigate({ to: "/characters" });
  }, [session, isDemo, navigate]);

  const [step, setStep] = useState<"pick" | "preview">("pick");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewB64, setPreviewB64] = useState<string>("");
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ field: string; message: string }[] | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportCharacter();

  const processFile = async (f: File | null) => {
    setFile(f);
    setPreviewErr(null);
    setFieldErrors(null);
    if (!f) return;
    if (f.type !== "" && f.type !== "image/png") {
      setPreviewErr("Only PNG files are supported.");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setPreviewErr("File too large (max 5 MB).");
      return;
    }
    try {
      const b64 = await fileToBase64(f);
      setPreviewB64(b64);
      const res = await previewCharacter({ data: { pngBase64: b64 } });
      if (!res.ok) {
        if (res.error.kind === "validation") {
          setFieldErrors(res.error.errors);
        } else {
          setPreviewErr(res.error.message);
        }
        return;
      }
      setPreview(res.data);
      setStep("preview");
    } catch (err) {
      setPreviewErr(err instanceof Error ? err.message : "Failed to read file");
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    processFile(e.target.files?.[0] ?? null);
  };

  const handleImport = async () => {
    if (!previewB64) return;
    const res = await importMutation.mutateAsync({ pngBase64: previewB64 });
    if (res.ok) {
      toast.success(`Imported ${res.character.name}`);
      void navigate({ to: "/characters/$id", params: { id: res.character.id } });
    } else {
      if (res.error.kind === "validation") {
        setFieldErrors(res.error.errors);
      } else {
        setPreviewErr(res.error.message);
      }
    }
  };

  return (
    <main className="mx-auto max-w-[768px] px-4 py-8">
      <PageHeader title="Import Character" backTo="/characters" />

      {step === "pick" ? (
        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              processFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center cursor-pointer hover:bg-surface transition-colors ${
              dragOver ? "border-brand bg-brand/5" : ""
            }`}
          >
            <Upload className="size-10 text-3" />
            <div>
              <p className="text-headline">Choose a PNG character card</p>
              <p className="text-2 text-sm mt-1">
                V2 or V3 card. Max 50 MB. Drag &amp; drop or click to browse.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              onChange={handleFileChange}
              disabled={importMutation.isPending}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Browse files
            </Button>
          </div>
          {fieldErrors ? <FieldErrorList errors={fieldErrors} /> : null}
          {previewErr ? <ErrorBanner message={previewErr} /> : null}
        </div>
      ) : null}

      {step === "preview" && preview ? (
        <div className="space-y-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStep("pick");
              setPreview(null);
            }}
          >
            <ArrowLeft className="size-4" /> Choose different file
          </Button>
          {/* Preview card */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex gap-4">
              {file ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={preview.preview.name}
                  className="size-32 aspect-[3/4] rounded-lg object-cover border shrink-0"
                />
              ) : null}
              <div className="min-w-0">
                <h2 className="text-headline">{preview.preview.name}</h2>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {preview.preview.creator ? (
                    <Badge variant="secondary" className="text-xs">
                      {preview.preview.creator}
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className="text-xs">
                    {preview.preview.spec} v{preview.preview.specVersion}
                  </Badge>
                </div>
                {preview.preview.descriptionExcerpt ? (
                  <p className="text-2 text-sm mt-2 line-clamp-2">
                    {preview.preview.descriptionExcerpt}
                  </p>
                ) : null}
                {preview.preview.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {preview.preview.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <div className="text-2 text-xs mt-2">
                  {preview.preview.greetingCount} greetings · {preview.preview.lorebookEntryCount}{" "}
                  lorebook entries
                </div>
              </div>
            </div>
          </div>
          {preview.preview.warnings.length > 0 ? (
            <div className="rounded-lg border bg-warning/10 p-3 text-xs text-warning space-y-1">
              {preview.preview.warnings.map((w, i) => (
                <p key={i}>
                  <TriangleAlert className="size-3 inline" /> {w}
                </p>
              ))}
            </div>
          ) : null}
          {preview.duplicateOf ? (
            <div className="rounded-lg border bg-warning/10 p-3 text-sm">
              <p>
                <strong className="text-warning">Duplicate detected:</strong> You already have a
                character named <strong>{preview.duplicateOf.name}</strong>. Importing will create a
                separate copy.
              </p>
            </div>
          ) : null}
          {fieldErrors ? <FieldErrorList errors={fieldErrors} /> : null}
          {previewErr ? <ErrorBanner message={previewErr} /> : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setStep("pick");
                setPreview(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={importMutation.isPending}>
              {importMutation.isPending ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function FieldErrorList({ errors }: { errors: { field: string; message: string }[] }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
    >
      <p className="font-medium">Card validation failed:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {errors.map((e, i) => (
          <li key={i}>
            <code className="font-mono">{e.field}</code>: {e.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
