import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type } from "arktype";
import { Upload, ArrowLeft, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { MAX_IMAGE_UPLOAD_BYTES } from "@/lib/image-optimization";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { RelativeTime } from "@/components/common/RelativeTime";
import { friendlyImportError } from "@/lib/error-copy";
import {
  fileToBase64,
  useCharacter,
  useImportCharacter,
  useUpdateCharacterFromCard,
} from "@/hooks/useCharacters";
import { previewCharacter } from "@/server/fns/characters";
import type { PreviewResult } from "@/server/fns/characters";

const searchSchema = type({
  "update?": "string > 0",
});

export const Route = createFileRoute("/characters/new")({
  validateSearch: searchSchema,
  component: NewCharacterPage,
});

export function NewCharacterPage() {
  const navigate = useNavigate();
  // Update mode: applying the picked card to an existing character directly
  // (from the detail page's ⋯ menu), bypassing the duplicate-choice flow.
  const { update: updateTargetId } = Route.useSearch();

  const [step, setStep] = useState<"pick" | "preview">("pick");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewB64, setPreviewB64] = useState<string>("");
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ field: string; message: string }[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportCharacter();
  const updateMutation = useUpdateCharacterFromCard();
  // The character being updated in update mode, for the subtitle, the
  // rename notice, and an upfront "gone" guard.
  const { data: updateTarget, error: updateTargetError } = useCharacter(updateTargetId ?? "");
  // Selected target for "update existing" when the card name matches one or
  // more characters; null means the user chose import-as-new.
  const [targetId, setTargetId] = useState<string | null>(null);
  // Set when the update target disappeared between preview and confirm and
  // cannot be re-picked (update mode). Disables the primary action.
  const [deadTarget, setDeadTarget] = useState(false);
  // `processing` drives the UI; `processingRef` guards re-entrancy (a state
  // snapshot is per-render and cannot stop a same-tick re-entry).
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewObjectUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewObjectUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const processFile = async (f: File | null) => {
    if (processingRef.current) return;
    setFile(f);
    setPreviewErr(null);
    setFieldErrors(null);
    setDeadTarget(false);
    if (!f) return;
    if (f.type !== "" && f.type !== "image/png") {
      setPreviewErr("That file isn't a PNG. Choose a character card PNG.");
      return;
    }
    if (f.size > MAX_IMAGE_UPLOAD_BYTES) {
      setPreviewErr("That file is larger than 50 MB.");
      return;
    }
    processingRef.current = true;
    setProcessing(true);
    try {
      const b64 = await fileToBase64(f);
      setPreviewB64(b64);
      const res = await previewCharacter({ data: { pngBase64: b64 } });
      if (!res.ok) {
        if (res.error.kind === "validation") {
          setFieldErrors(res.error.errors);
        } else {
          setPreviewErr(friendlyImportError(res.error.message));
        }
        return;
      }
      setPreview(res.data);
      setTargetId(res.data.duplicates[0]?.id ?? null);
      setStep("preview");
    } catch (err) {
      setPreviewErr(friendlyImportError(err));
    } finally {
      processingRef.current = false;
      setProcessing(false);
      // Clear stale input so re-selecting the same file fires `change` again.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    processFile(e.target.files?.[0] ?? null);
  };

  const handleImport = async (asUpdate: boolean) => {
    if (!previewB64) return;
    setPreviewErr(null);
    setFieldErrors(null);

    if (asUpdate) {
      const target = updateTargetId ?? targetId;
      if (!target) return;
      let res: Awaited<ReturnType<typeof updateMutation.mutateAsync>>;
      try {
        res = await updateMutation.mutateAsync({ pngBase64: previewB64, targetId: target });
      } catch (err) {
        setPreviewErr(friendlyImportError(err));
        return;
      }
      if (res.ok) {
        const parts = [`Updated "${res.character.name}"`];
        if (res.lorebook) {
          parts.push(
            `lorebook "${res.lorebook.name}" · ${res.lorebook.entriesInserted} ${
              res.lorebook.entriesInserted === 1 ? "entry" : "entries"
            }`,
          );
        }
        toast.success(parts.join(" · "));
        void navigate({ to: "/characters/$id", params: { id: res.character.id } });
      } else {
        if (res.error.kind === "validation") {
          setFieldErrors(res.error.errors);
        } else if (res.error.kind === "target_missing") {
          // The service already provides user-ready copy.
          setPreviewErr(res.error.message);
          if (updateTargetId) {
            // Update mode: the target comes from the URL and cannot be
            // re-picked — lock the action instead of retrying a dead id.
            setDeadTarget(true);
          } else {
            // Duplicate-picker flow: drop the stale selection so the panel
            // shows nothing selected and the primary falls back to Import.
            setTargetId(null);
          }
        } else {
          setPreviewErr(friendlyImportError(res.error.message));
        }
        toast.error("Card update failed");
      }
      return;
    }

    let res: Awaited<ReturnType<typeof importMutation.mutateAsync>>;
    try {
      res = await importMutation.mutateAsync({ pngBase64: previewB64 });
    } catch (err) {
      setPreviewErr(friendlyImportError(err));
      toast.error("Import failed");
      return;
    }
    if (res.ok) {
      const parts = [`Imported "${res.character.name}"`];
      if (res.lorebook) {
        parts.push(
          `lorebook "${res.lorebook.name}" · ${res.lorebook.entriesInserted} ${
            res.lorebook.entriesInserted === 1 ? "entry" : "entries"
          }`,
        );
      }
      toast.success(parts.join(" · "));
      void navigate({ to: "/characters/$id", params: { id: res.character.id } });
    } else {
      if (res.error.kind === "validation") {
        setFieldErrors(res.error.errors);
      } else {
        setPreviewErr(friendlyImportError(res.error.message));
      }
      toast.error("Import failed");
    }
  };

  // Dead update target: the character was deleted between opening the page
  // and now. Block the flow upfront instead of failing after a full preview.
  if (updateTargetId && updateTargetError) {
    return (
      <main className="mx-auto max-w-[768px] px-4 py-8">
        <PageHeader title="Update character" backTo="/characters" />
        <ErrorBanner message="The character you want to update no longer exists." />
      </main>
    );
  }

  const selectedDuplicate = preview?.duplicates.find((d) => d.id === targetId);
  const primaryLabel = updateMutation.isPending
    ? "Updating…"
    : importMutation.isPending
      ? "Importing…"
      : updateTargetId
        ? "Update character"
        : selectedDuplicate
          ? `Update “${clampName(selectedDuplicate.name)}”`
          : "Import";

  return (
    <main className="mx-auto max-w-[768px] px-4 py-8">
      <PageHeader
        title={updateTargetId ? "Update character" : "Import character"}
        subtitle={updateTarget?.name ? `Updating “${updateTarget.name}”` : undefined}
        backTo={updateTargetId ? `/characters/${updateTargetId}` : "/characters"}
      />

      {step === "pick" ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (processingRef.current) return;
              processFile(e.dataTransfer.files?.[0] ?? null);
            }}
            disabled={processing || importMutation.isPending || updateMutation.isPending}
            className={`flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-transparent p-12 text-center hover:border-brand/40 hover:bg-brand/5 transition-colors disabled:pointer-events-none disabled:opacity-50 ${
              dragOver ? "border-brand bg-brand/5" : ""
            }`}
          >
            {processing ? (
              <Spinner className="size-10 text-2" />
            ) : (
              <Upload className="size-10 text-2" />
            )}
            <div>
              <p className="text-headline">
                {processing ? "Processing…" : "Choose a character card PNG"}
              </p>
              <p className="text-2 text-sm mt-1">
                V2 or V3 · up to 50 MB · drag &amp; drop or click to browse
              </p>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png"
            onChange={handleFileChange}
            disabled={processing || importMutation.isPending || updateMutation.isPending}
            className="hidden"
            aria-label="Choose a character card PNG"
          />
          {fieldErrors ? <FieldErrorList errors={fieldErrors} /> : null}
          {previewErr ? <ErrorBanner title="Couldn’t read that card" message={previewErr} /> : null}
        </div>
      ) : null}

      {step === "preview" && preview ? (
        <div className="space-y-6">
          <Button
            variant="ghost"
            size="sm"
            disabled={importMutation.isPending || updateMutation.isPending}
            onClick={() => {
              setStep("pick");
              setPreview(null);
            }}
          >
            <ArrowLeft className="size-4" data-icon="inline-start" /> Choose different file
          </Button>
          {/* Preview card */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex gap-4">
              {previewObjectUrl ? (
                <OptimizedImage
                  src={previewObjectUrl}
                  alt={preview.preview.name}
                  preset="portrait"
                  intrinsicSize={false}
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
                      <Badge key={t} variant="secondary" className="text-[11px]">
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
          {!updateTargetId && preview.duplicates.length > 0 ? (
            <div className="rounded-lg border bg-warning/10 p-3 text-sm">
              <p className="mb-2">
                <strong className="text-warning">Duplicate detected:</strong> You already have{" "}
                {preview.duplicates.length === 1
                  ? "a character named"
                  : `${preview.duplicates.length} characters named`}{" "}
                <strong>{preview.duplicates[0]!.name}</strong>. Update it from this card, or import
                it as a separate copy.
              </p>
              <RadioGroup
                value={targetId ?? ""}
                onValueChange={(v) => setTargetId(v)}
                className="gap-2"
                aria-label="Existing character to update"
              >
                {preview.duplicates.map((dup) => (
                  <Label
                    key={dup.id}
                    htmlFor={`dup-${dup.id}`}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border bg-surface px-3 py-2 font-normal hover:bg-raised"
                  >
                    <RadioGroupItem value={dup.id} id={`dup-${dup.id}`} />
                    <span className="min-w-0 flex-1 truncate">{dup.name}</span>
                    <span className="text-3 shrink-0 text-xs">
                      updated <RelativeTime date={new Date(dup.updatedAt)} />
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          ) : null}
          {updateTargetId && updateTarget && preview.preview.name !== updateTarget.name ? (
            <p className="text-2 text-sm">
              This will rename “{updateTarget.name}” to “{preview.preview.name}”.
            </p>
          ) : null}
          {fieldErrors ? <FieldErrorList errors={fieldErrors} /> : null}
          {previewErr ? <ErrorBanner title="Couldn’t read that card" message={previewErr} /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              disabled={importMutation.isPending || updateMutation.isPending}
              onClick={() => {
                if (updateTargetId) {
                  // In update mode the character is the task context; leave
                  // the flow entirely instead of bouncing back to the picker.
                  void navigate({ to: "/characters/$id", params: { id: updateTargetId } });
                  return;
                }
                setStep("pick");
                setPreview(null);
              }}
            >
              Cancel
            </Button>
            {!updateTargetId && preview.duplicates.length > 0 ? (
              <Button
                variant="outline"
                onClick={() => void handleImport(false)}
                disabled={importMutation.isPending || updateMutation.isPending}
              >
                Import as new
              </Button>
            ) : null}
            <Button
              onClick={() => void handleImport(updateTargetId ? true : Boolean(targetId))}
              disabled={deadTarget || importMutation.isPending || updateMutation.isPending}
            >
              {primaryLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

/** Buttons are whitespace-nowrap; clamp user data so the footer can't overflow. */
function clampName(name: string, max = 24): string {
  return name.length > max ? `${name.slice(0, max)}…` : name;
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
