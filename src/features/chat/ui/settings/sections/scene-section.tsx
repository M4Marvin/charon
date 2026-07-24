import { useState, useRef, useCallback } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBackgrounds, useUploadBackground, useDeleteBackground } from "@/hooks/useBackgrounds";
import { useChatConfig, useUpdateChatOverrides } from "@/hooks/useChatConfig";
import { ConfirmDialog } from "../confirm-dialog";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
  isAdmin: boolean;
}

export function SceneSection({ chatId, isAdmin, isStreaming }: SectionProps) {
  const { data: config } = useChatConfig(chatId);
  const { data: backgrounds } = useBackgrounds();
  const updateOverrides = useUpdateChatOverrides();
  const uploadBg = useUploadBackground();
  const deleteBgMutation = useDeleteBackground();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedId = config?.chat.backgroundId ?? null;

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
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        if (base64) {
          uploadBg.mutate({ name: file.name.replace(/\.[^.]+$/, ""), fileBase64: base64 });
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
    deleteBgMutation.mutate({ id: deleteTarget }, { onSuccess: () => setDeleteTarget(null) });
  }, [deleteTarget, deleteBgMutation, selectedId, handleSelect]);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm font-heading text-[--sea-ink]">Scene</p>

      <div className="grid grid-cols-3 gap-2">
        {backgrounds?.map((bg) => (
          <button
            key={bg.id}
            type="button"
            onClick={() => handleSelect(bg.id === selectedId ? null : bg.id)}
            disabled={isStreaming}
            className={`group relative aspect-video overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10 transition ${
              bg.id === selectedId ? "ring-[--lagoon] ring-2" : "hover:ring-white/20"
            }`}
            aria-label={`${bg.name}${bg.id === selectedId ? " (selected)" : ""}`}
          >
            <img
              src={`/${bg.path}`}
              alt={bg.name}
              className="size-full object-cover"
            />
            {isAdmin && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(bg.id); }}
                className="absolute top-0.5 right-0.5 z-10 size-6 rounded-full bg-black/60 flex items-center justify-center text-white/50 hover:text-white hover:bg-black/80"
                aria-label={`Delete ${bg.name}`}
              >
                <X className="size-3" />
              </button>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {selectedId && (
          <Button variant="ghost" size="sm" className="text-[11px]" onClick={() => handleSelect(null)} aria-label="Clear background">
            <X className="size-3.5 mr-1" />
            Clear scene
          </Button>
        )}
        {isAdmin && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileRef.current?.click()}
              disabled={isStreaming || uploadBg.isPending}
            >
              {uploadBg.isPending ? (
                "Uploading..."
              ) : (
                <>
                  <Upload className="size-3.5" />
                  Upload
                </>
              )}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              aria-label="Upload background image"
            />
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete background?"
        description="This removes the background image from your library. Chats using it will be unaffected."
        onConfirm={handleDeleteBg}
      />
    </div>
  );
}
