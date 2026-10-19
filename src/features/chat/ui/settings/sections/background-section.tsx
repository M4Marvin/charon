import { useState, useRef, useCallback } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
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
import { SectionHeader } from "../section-header";

interface SectionProps {
  chatId: string;
}

export function BackgroundSection({ chatId }: SectionProps) {
  const { data: config, error: configError, refetch: refetchConfig } = useChatConfig(chatId);
  const {
    data: backgrounds,
    isLoading,
    error: backgroundsError,
    refetch: refetchBackgrounds,
  } = useBackgrounds();
  const updateOverrides = useUpdateChatOverrides();
  const uploadBg = useUploadBackground();
  const deleteBgMutation = useDeleteBackground();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedId = config?.chat.backgroundId ?? null;
  const queryError = configError ?? backgroundsError;

  const handleSelect = useCallback(
    (id: string | null) => {
      updateOverrides.mutate(
        { id: chatId, backgroundId: id },
        {
          onError: (err) =>
            toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`),
        },
      );
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
              onError: (err) =>
                toast.error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`),
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
        onError: (err) =>
          toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`),
      },
    );
  }, [deleteTarget, deleteBgMutation, selectedId, handleSelect]);

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title="Background" description="The scene behind this chat." scope="chat" />

      {queryError ? (
        <ErrorBanner
          message={queryError instanceof Error ? queryError.message : "Failed to load backgrounds"}
          onRetry={() => {
            void Promise.all([refetchConfig(), refetchBackgrounds()]);
          }}
        />
      ) : null}

      {isLoading ? (
        <SkeletonCardGrid count={6} lanes={3} aspect="aspect-video" />
      ) : backgroundsError ? null : backgrounds?.length ? (
        <div className="grid grid-cols-3 gap-2">
          {backgrounds.map((bg) => {
            const src = withImageVersion(`/api/backgrounds/${bg.id}/image`, bg.path);
            return (
              <div key={bg.id} className="relative">
                <button
                  type="button"
                  onClick={() => handleSelect(bg.id === selectedId ? null : bg.id)}
                  className={`group relative aspect-video w-full overflow-hidden rounded-lg bg-raised ring-1 transition focus-ring ${
                    bg.id === selectedId ? "ring-brand ring-2" : "ring-border hover:ring-brand/40"
                  }`}
                  aria-label={`${bg.name}${bg.id === selectedId ? " (selected)" : ""}`}
                >
                  {failedSrc !== src ? (
                    <OptimizedImage
                      key={bg.path}
                      src={src}
                      alt={bg.name}
                      preset="scene"
                      intrinsicSize={false}
                      quality={70}
                      className="size-full object-cover"
                      onError={() => setFailedSrc(src)}
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-raised">
                      <span className="font-heading text-2xl text-2">{bg.name.charAt(0)}</span>
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(bg.id)}
                  className="absolute top-0.5 right-0.5 z-10 flex size-8 items-center justify-center rounded-full bg-(--bg-base)/80 text-2 after:absolute after:-inset-1 hover:bg-raised hover:text-danger focus-ring"
                  aria-label={`Delete ${bg.name}`}
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={ImageIcon}
          title="No backgrounds yet"
          description="Upload a background image to set the scene."
        />
      )}

      <div className="flex items-center gap-2">
        {selectedId && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => handleSelect(null)}
            aria-label="Clear background"
          >
            <X className="size-3.5 mr-1" data-icon="inline-start" />
            Clear scene
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploadBg.isPending}
          className="flex items-center gap-1.5"
        >
          {uploadBg.isPending ? (
            <Spinner className="size-3.5" />
          ) : (
            <Upload className="size-3.5" data-icon="inline-start" />
          )}
          Upload
        </Button>
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
      </div>

      {uploadError ? (
        <p className="text-xs text-destructive" role="alert">
          {uploadError}
        </p>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete background?"
        description="This removes the background image from your library. Chats using it will lose this background."
        destructive
        loading={deleteBgMutation.isPending}
        onConfirm={handleDeleteBg}
      />
    </div>
  );
}
