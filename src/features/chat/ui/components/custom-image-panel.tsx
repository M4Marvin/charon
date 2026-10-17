import { useEffect, useRef, useCallback, useState } from "react";
import { X, ImageIcon, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { MAX_IMAGE_UPLOAD_BYTES } from "@/lib/image-optimization";
import { cn } from "@/lib/utils";

const PANEL_SIZES = "min(24rem, max(12rem, calc((100vw - 48rem)/2 - 2rem)))";

interface CustomImagePanelProps {
  open: boolean;
  imageSrc: string | null;
  customImageSrc: string | null;
  alt?: string;
  onClose: () => void;
  onImageClick: () => void;
  onUploadImage: (file: File) => void;
  onClearImage: () => void;
}

export function CustomImagePanel({
  open,
  imageSrc,
  customImageSrc,
  alt,
  onClose,
  onImageClick,
  onUploadImage,
  onClearImage,
}: CustomImagePanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const confirmOpenRef = useRef(false);
  const [keepImageMounted, setKeepImageMounted] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    if (open) {
      setKeepImageMounted(true);
      setUploadError(null);
      return;
    }

    setConfirmClearOpen(false);
    const timer = window.setTimeout(() => setKeepImageMounted(false), 300);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    confirmOpenRef.current = confirmClearOpen;
  }, [confirmClearOpen]);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
      if (confirmOpenRef.current) return;
      onCloseRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const shouldMountImage = open || keepImageMounted;

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        setUploadError(`File too large (max ${MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024)} MB).`);
        e.target.value = "";
        return;
      }
      setUploadError(null);
      onUploadImage(file);
      e.target.value = "";
    },
    [onUploadImage],
  );

  const displaySrc = customImageSrc ?? imageSrc;
  const isCustom = customImageSrc !== null;
  const hasImage = displaySrc !== null;
  const canOpen = hasImage && !imageFailed;
  const label = isCustom ? "Custom" : "Scene";
  const imageAlt = alt ?? `${label} image`;

  useEffect(() => setImageFailed(false), [displaySrc]);

  return (
    <div
      id="custom-image-panel"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "fixed right-4 top-1/2 -translate-y-1/2 z-20 hidden xl:flex flex-col gap-2 transition-all duration-300",
        open ? "translate-x-0 opacity-100" : "translate-x-[calc(100%_+_2rem)] opacity-0",
      )}
    >
      <div
        className={cn(
          "glass-strong rounded-2xl overflow-hidden shadow-xl ring-1 ring-(--border-subtle) w-[min(24rem,max(12rem,calc((100vw_-_48rem)/2_-_2rem)))]",
          canOpen && "cursor-pointer group focus-ring",
        )}
        onClick={canOpen ? onImageClick : undefined}
        role={canOpen ? "button" : undefined}
        tabIndex={canOpen ? 0 : -1}
        aria-label={canOpen ? `View ${label.toLowerCase()} image` : undefined}
        onKeyDown={(e) => {
          if (!canOpen) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onImageClick();
          }
        }}
      >
        <div className="relative flex items-center justify-center bg-(--bg-base)/60">
          {shouldMountImage && displaySrc && !imageFailed ? (
            <OptimizedImage
              key={displaySrc}
              src={displaySrc}
              alt={imageAlt}
              preset="scene"
              intrinsicSize={false}
              sizes={PANEL_SIZES}
              className="w-full h-auto block transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-(--sea-ink-soft) py-10 w-full">
              <ImageIcon className="size-6 opacity-40" />
              <span className="text-xs">No scene set</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 self-start -mt-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full glass text-2 hover:text-1"
          onClick={() => fileRef.current?.click()}
          aria-label="Upload custom image"
        >
          <ImagePlus className="size-3.5" />
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          aria-label="Upload custom image file"
        />
        {isCustom && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full glass text-2 hover:text-danger"
            onClick={() => setConfirmClearOpen(true)}
            aria-label="Clear custom image"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
        <Button
          ref={closeButtonRef}
          variant="ghost"
          size="icon"
          className="size-8 rounded-full glass text-2 hover:text-1"
          onClick={onClose}
          aria-label="Close scene panel"
        >
          <X className="size-3.5" />
        </Button>
      </div>
      {uploadError ? (
        <p className="max-w-64 text-xs text-danger" role="alert">
          {uploadError}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title="Clear custom image?"
        description="This removes the uploaded scene image for this chat. It can't be undone."
        confirmLabel="Clear image"
        destructive
        onConfirm={() => {
          setConfirmClearOpen(false);
          onClearImage();
        }}
      />
    </div>
  );
}
