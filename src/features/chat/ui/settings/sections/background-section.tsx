import { useState, useRef, useCallback } from "react";
import { Ban, Check, Image as ImageIcon, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonCardGrid } from "@/components/common/Skeletons";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useBackgrounds, useUploadBackground, useDeleteBackground } from "@/hooks/useBackgrounds";
import { MAX_IMAGE_UPLOAD_BYTES, withImageVersion } from "@/lib/image-optimization";
import { useChatConfig, useUpdateChatOverrides } from "@/hooks/useChatConfig";
import { useChatUiStore } from "../../chat-store";
import { SectionHeader } from "../section-header";
import { getSaveState, useSettingsSaveStatus } from "../save-status";

interface SectionProps {
  chatId: string;
  onOpenScenePanel?: () => void;
}

export function BackgroundSection({ chatId, onOpenScenePanel }: SectionProps) {
  const { data: config, error: configError, refetch: refetchConfig } = useChatConfig(chatId);
  const {
    data: backgrounds,
    isLoading,
    error: backgroundsError,
    refetch: refetchBackgrounds,
  } = useBackgrounds();
  const updateOverrides = useUpdateChatOverrides();
  const retrySave = updateOverrides.variables
    ? () => updateOverrides.mutate(updateOverrides.variables!)
    : undefined;
  useSettingsSaveStatus("background", getSaveState(updateOverrides), {
    retry: retrySave,
    at: updateOverrides.submittedAt,
    error: updateOverrides.error,
  });
  const uploadBg = useUploadBackground();
  const deleteBgMutation = useDeleteBackground();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedId = config?.chat.backgroundId ?? null;
  const customImage = useChatUiStore((state) => state.customImages[chatId] ?? null);
  const queryError = configError ?? backgroundsError;
  const selectedBackground = backgrounds?.find((bg) => bg.id === selectedId) ?? null;

  const handleSelect = useCallback(
    (id: string | null) => {
      updateOverrides.mutate({ id: chatId, backgroundId: id });
    },
    [chatId, updateOverrides],
  );

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        setUploadError(`File too large (max ${MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024)} MB).`);
        e.target.value = "";
        return;
      }
      setUploadError(null);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        if (base64) {
          uploadBg.mutate(
            { name: file.name.replace(/\.[^.]+$/, ""), fileBase64: base64 },
            {
              onError: (err) => {
                console.error("[settings] upload background failed", err);
                toast.error("Couldn't upload this image. Please try again.");
              },
            },
          );
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [uploadBg],
  );

  const handleDeleteBg = useCallback(() => {
    if (!deleteTarget) return;
    if (deleteTarget === selectedId) handleSelect(null);
    deleteBgMutation.mutate(
      { id: deleteTarget },
      {
        onSuccess: () => {
          toast.success("Background deleted");
          setDeleteTarget(null);
        },
        onError: (err) => {
          console.error("[settings] delete background failed", err);
          toast.error("Couldn't delete this background. Please try again.");
        },
      },
    );
  }, [deleteTarget, deleteBgMutation, selectedId, handleSelect]);

  const deleteTargetName = backgrounds?.find((bg) => bg.id === deleteTarget)?.name;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Background"
        description="The scene behind this chat. Backgrounds are shared across chats."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-1.5 max-sm:h-11"
            onClick={() => fileRef.current?.click()}
            disabled={uploadBg.isPending}
          >
            {uploadBg.isPending ? (
              <Spinner className="size-3.5" />
            ) : (
              <Upload className="size-3.5" aria-hidden="true" />
            )}
            Upload
          </Button>
        }
      />
      <span role="status" className="sr-only">
        {uploadBg.isPending ? "Uploading background image" : ""}
      </span>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/tiff,image/gif,image/avif"
        className="hidden"
        onChange={handleUpload}
        aria-label="Upload background image"
      />

      {queryError ? (
        <ErrorBanner
          message={queryError instanceof Error ? queryError.message : "Failed to load backgrounds"}
          onRetry={() => {
            void Promise.all([refetchConfig(), refetchBackgrounds()]);
          }}
        />
      ) : null}

      {customImage ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/25 bg-warning/10 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-2">
            A custom image is overriding the scene background.
          </p>
          {onOpenScenePanel ? (
            <Button variant="outline" size="sm" className="h-9" onClick={onOpenScenePanel}>
              Open scene panel
            </Button>
          ) : null}
        </div>
      ) : null}

      {selectedBackground ? (
        <div className="overflow-hidden rounded-2xl border border-subtle bg-surface/60">
          <div className="relative aspect-[2.1/1] w-full bg-raised">
            <OptimizedImage
              key={selectedBackground.path}
              src={withImageVersion(
                `/api/backgrounds/${selectedBackground.id}/image`,
                selectedBackground.path,
              )}
              alt={selectedBackground.name}
              preset="scene"
              intrinsicSize={false}
              quality={80}
              className="size-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-2.5">
              <p className="truncate text-xs font-medium text-white">{selectedBackground.name}</p>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
                <Check className="size-3" aria-hidden="true" />
                In use
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-subtle px-3 py-2">
            <p className="text-[11px] text-2">
              {customImage ? "Hidden by your custom image" : "Used as this chat's background"}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1 text-xs text-2 hover:text-1"
              onClick={() => handleSelect(null)}
            >
              <X className="size-3.5" aria-hidden="true" />
              Clear scene
            </Button>
          </div>
        </div>
      ) : null}

      {uploadError ? (
        <p className="text-xs text-danger" role="alert">
          {uploadError}
        </p>
      ) : null}

      {isLoading ? (
        <div role="status" aria-label="Loading backgrounds">
          <SkeletonCardGrid count={6} lanes={3} aspect="aspect-video" />
          <span className="sr-only">Loading backgrounds</span>
        </div>
      ) : backgroundsError ? null : backgrounds?.length ? (
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3">
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={`flex aspect-video flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-xs transition-colors focus-ring ${
              selectedId === null
                ? "border-brand/40 bg-brand/5 text-brand"
                : "border-subtle text-2 hover:border-border hover:bg-(--bg-hover)/50 hover:text-1"
            }`}
            aria-pressed={selectedId === null}
          >
            <Ban className="size-5" aria-hidden="true" />
            No background
          </button>
          {backgrounds.map((bg) => {
            const src = withImageVersion(`/api/backgrounds/${bg.id}/image`, bg.path);
            const selected = bg.id === selectedId;
            return (
              <div key={bg.id} className="group min-w-0">
                <button
                  type="button"
                  onClick={() => handleSelect(selected ? null : bg.id)}
                  className={`relative block aspect-video w-full overflow-hidden rounded-xl bg-raised ring-1 transition focus-ring ${
                    selected ? "ring-2 ring-brand" : "ring-border hover:ring-brand/40"
                  }`}
                  aria-label={`${bg.name}${selected ? " (in use)" : ""}`}
                  aria-pressed={selected}
                >
                  {failedSrc !== src ? (
                    <OptimizedImage
                      key={bg.path}
                      src={src}
                      alt=""
                      preset="scene"
                      intrinsicSize={false}
                      quality={70}
                      className="size-full object-cover"
                      onError={() => setFailedSrc(src)}
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-raised">
                      <span className="font-heading text-2xl text-2">
                        {bg.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {selected ? (
                    <>
                      <span className="pointer-events-none absolute top-2 left-2 z-10 flex size-5 items-center justify-center rounded-full bg-brand text-(--bg-base)">
                        <Check className="size-3" aria-hidden="true" />
                      </span>
                      <span className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
                        In use
                      </span>
                    </>
                  ) : null}
                </button>
                <div className="mt-1.5 flex items-center justify-between gap-1 px-0.5">
                  <p className="truncate text-xs text-2" title={bg.name}>
                    {bg.name}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(bg.id)}
                    className="size-8 shrink-0 text-2 opacity-100 hover:bg-danger/10 hover:text-danger max-sm:size-11 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    aria-label={`Delete ${bg.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={ImageIcon}
          title="No backgrounds yet"
          description="Upload an image to set the scene for this chat."
          titleAs="h3"
        >
          <Button
            variant="outline"
            className="h-11 gap-1.5"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-3.5" aria-hidden="true" />
            Upload an image
          </Button>
        </EmptyState>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete ${deleteTargetName ?? "background"}?`}
        description="This removes the image from your library. Any chat using it will lose this background."
        destructive
        loading={deleteBgMutation.isPending}
        onConfirm={handleDeleteBg}
      />
    </div>
  );
}
