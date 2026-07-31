import { useLayoutEffect, useRef, useCallback } from "react";
import { ArrowUp, Square, Wand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { useChatUiStore } from "../chat-store";

const TEXTAREA_MAX_HEIGHT = 120;

interface ComposerProps {
  chatId: string;
  hasMessages: boolean;
  onSend: () => void;
  onStop: () => void;
  onImpersonate: () => void;
  isStreaming: boolean;
  impersonatePending: boolean;
  disabled: boolean;
  characterName?: string;
}

export function Composer({
  chatId,
  hasMessages,
  onSend,
  onStop,
  onImpersonate,
  isStreaming,
  impersonatePending,
  disabled,
  characterName,
}: ComposerProps) {
  const value = useChatUiStore((s) => s.inputDrafts[chatId] ?? "");
  const setInputDraft = useChatUiStore((s) => s.setInputDraft);
  const canSend = (value.trim().length > 0 || hasMessages) && !isStreaming;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (isStreaming) {
          onStop();
        } else if (canSend) {
          onSend();
        }
      }
    },
    [isStreaming, canSend, onSend, onStop],
  );

  const placeholder = characterName
    ? `Message ${characterName}…  (Enter to send, Shift+Enter for a line break)`
    : "Enter to send, Shift+Enter for a line break";

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-4 md:pb-5">
      <div className="mx-auto max-w-3xl">
        <div className="glass rounded-2xl flex items-end gap-2 px-3 py-2 md:px-4">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setInputDraft(chatId, e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label="Message"
            rows={1}
            disabled={disabled}
            className="min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent px-1 py-1.5 text-[15px] leading-6 placeholder:text-white/30 text-[--sea-ink] no-scrollbar focus-visible:ring-0"
          />

          <div className="flex items-center gap-1 pb-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full text-white/40 hover:text-[--lagoon] disabled:opacity-30"
              onClick={onImpersonate}
              disabled={disabled || isStreaming || impersonatePending}
              aria-label="Impersonate"
            >
              {impersonatePending ? <Spinner className="size-4" /> : <Wand className="size-4" />}
            </Button>

            {isStreaming ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full text-white/80 hover:text-red-400"
                onClick={onStop}
                aria-label="Stop generating"
              >
                <Square className="size-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full text-white/40 hover:text-white disabled:opacity-20"
                onClick={onSend}
                disabled={!canSend || disabled}
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
