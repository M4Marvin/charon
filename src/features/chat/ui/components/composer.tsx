import { useLayoutEffect, useRef, useCallback, useEffect } from "react";
import { ArrowUp, Palette, Square, Wand } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { useChatUiStore, selectComposerFocusNonce } from "../chat-store";

const TEXTAREA_MAX_HEIGHT = 120;
const IMAGE_UNSUPPORTED_MESSAGE = "Images aren't supported in the composer — use the scene panel";

interface ComposerProps {
  chatId: string;
  hasMessages: boolean;
  onSend: () => void;
  onStop: () => void;
  onImpersonate: () => void;
  onImagePrompt: () => void;
  isStreaming: boolean;
  isFinalizing?: boolean;
  impersonatePending: boolean;
  imagePromptPending: boolean;
  disabled: boolean;
  characterName?: string;
}

export function Composer({
  chatId,
  hasMessages,
  onSend,
  onStop,
  onImpersonate,
  onImagePrompt,
  isStreaming,
  isFinalizing = false,
  impersonatePending,
  imagePromptPending,
  disabled,
  characterName,
}: ComposerProps) {
  const value = useChatUiStore((s) => s.inputDrafts[chatId] ?? "");
  const setInputDraft = useChatUiStore((s) => s.setInputDraft);
  const canSend =
    !disabled && !isStreaming && !isFinalizing && (value.trim().length > 0 || hasMessages);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusNonce = useChatUiStore(selectComposerFocusNonce);

  const focusTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  // Auto-focus when the composer mounts (page load) or the chat changes.
  // Skip coarse pointers so the on-screen keyboard doesn't pop on touch devices.
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    focusTextarea();
  }, [chatId, focusTextarea]);

  // Refocus after explicit actions (panel closes, edits, deletes, etc.).
  useEffect(() => {
    if (focusNonce === 0) return;
    focusTextarea();
  }, [focusNonce, focusTextarea]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (!value.trim()) {
      el.style.height = "";
      el.style.overflowY = "hidden";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
  }, [value]);

  // Platforms whose layout viewport does not shrink with the keyboard (iOS
  // Safari) still need the shell to reserve the covered band. Android's
  // `interactive-widget=resizes-content` already shrinks it, so the inset is 0.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const updateInset = () => {
      // Pinch-zoom shrinks the visual viewport without a keyboard; ignore it.
      if (viewport.scale !== 1) {
        root.style.setProperty("--keyboard-inset", "0px");
        return;
      }
      const inset = Math.max(
        0,
        Math.min(
          window.innerHeight - viewport.height - viewport.offsetTop,
          window.innerHeight * 0.75,
        ),
      );
      root.style.setProperty("--keyboard-inset", `${inset}px`);
    };
    updateInset();
    viewport.addEventListener("resize", updateInset);
    viewport.addEventListener("scroll", updateInset);
    return () => {
      viewport.removeEventListener("resize", updateInset);
      viewport.removeEventListener("scroll", updateInset);
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);

  const notifyImageUnsupported = useCallback(() => {
    toast.info(IMAGE_UNSUPPORTED_MESSAGE);
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const hasImageFile = Array.from(e.clipboardData?.files ?? []).some((file) =>
        file.type.startsWith("image/"),
      );
      const hasImageItem = Array.from(e.clipboardData?.items ?? []).some(
        (item) => item.kind === "file" && item.type.startsWith("image/"),
      );
      if (hasImageFile || hasImageItem) notifyImageUnsupported();
    },
    [notifyImageUnsupported],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (Array.from(e.dataTransfer?.types ?? []).includes("Files")) e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      const hasImageFile = Array.from(e.dataTransfer?.files ?? []).some((file) =>
        file.type.startsWith("image/"),
      );
      if (!(e.dataTransfer?.files.length ?? 0)) return;
      // The app has no attachments: never let a dropped file navigate the page.
      e.preventDefault();
      if (hasImageFile) notifyImageUnsupported();
    },
    [notifyImageUnsupported],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      // Enter belongs to the IME while a composition is active.
      if (e.nativeEvent.isComposing || e.keyCode === 229 || e.repeat) return;
      // No action available: leave Enter to the textarea instead of swallowing it.
      if (isFinalizing || (!isStreaming && (disabled || !canSend))) return;

      e.preventDefault();
      if (isStreaming) {
        onStop();
      } else {
        onSend();
      }
    },
    [isFinalizing, isStreaming, canSend, onSend, onStop],
  );

  const placeholder = isFinalizing
    ? "Finishing generation…"
    : isStreaming
      ? "Press Enter to stop generating…  (Shift+Enter for a line break)"
      : disabled
        ? "Another generation is running — you can draft, but sending is locked"
        : characterName
          ? `Message ${characterName}…`
          : "Write a message…";

  return (
    <div
      className="relative z-30 w-full shrink-0 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="mx-auto max-w-3xl">
        <div className="glass rounded-2xl flex items-end gap-2 px-3 py-2 md:px-4">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setInputDraft(chatId, e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            aria-label="Message"
            rows={1}
            className="min-h-10 max-h-[120px] resize-none overflow-y-auto border-0 bg-transparent px-1 py-1.5 text-sm leading-6 text-1 placeholder:text-3 focus-visible:ring-0"
          />

          <div className="flex items-center gap-1 pb-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-full text-2 hover:text-brand disabled:opacity-30"
              onClick={() => {
                onImagePrompt();
                focusTextarea();
              }}
              disabled={disabled || isStreaming || imagePromptPending}
              aria-label="Generate image prompt"
            >
              {imagePromptPending ? <Spinner className="size-4" /> : <Palette className="size-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-full text-2 hover:text-brand disabled:opacity-30"
              onClick={() => {
                onImpersonate();
                focusTextarea();
              }}
              disabled={disabled || isStreaming || impersonatePending}
              aria-label="Impersonate"
            >
              {impersonatePending ? <Spinner className="size-4" /> : <Wand className="size-4" />}
            </Button>

            {isStreaming || isFinalizing ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full text-1 hover:text-danger disabled:opacity-60"
                onClick={() => {
                  onStop();
                  focusTextarea();
                }}
                disabled={isFinalizing}
                aria-label={isFinalizing ? "Stopping generation" : "Stop generating"}
              >
                {isFinalizing ? <Spinner className="size-4" /> : <Square className="size-4" />}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full text-2 hover:text-brand disabled:opacity-20"
                onClick={() => {
                  onSend();
                  focusTextarea();
                }}
                disabled={!canSend}
                aria-label="Send message"
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
