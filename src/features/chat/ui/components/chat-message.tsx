import { memo, useState, useLayoutEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, RotateCw, Pencil, Trash2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RichText } from "@/components/RichText";
import { balanceMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { useChatUiStore } from "../chat-store";
import type { ActivePathEntry } from "@/features/chat/tree/types";

const TEXTAREA_MAX_HEIGHT = 240;

interface ChatMessageProps {
  entry: ActivePathEntry;
  isStreaming: boolean;
  streamingText: string;
  isNewest: boolean;
  characterName: string;
  userName: string;
  avatarSrc: string | null;
  disabled: boolean;
  /** Visual-only overlay entry (e.g. instant-send pending): non-interactive. */
  synthetic?: boolean;
  onSwipe: (messageLocalId: number, direction: "next" | "prev") => void;
  onRegenerate: (messageLocalId: number) => void;
  onEdit: (messageLocalId: number, content: string) => boolean;
  onDelete: (messageLocalId: number) => boolean;
}

export const ChatMessage = memo(function ChatMessage({
  entry,
  isStreaming,
  streamingText,
  isNewest,
  characterName,
  userName,
  avatarSrc,
  disabled,
  synthetic = false,
  onSwipe,
  onRegenerate,
  onEdit,
  onDelete,
}: ChatMessageProps) {
  const { message, siblingIndex, siblingTotal } = entry;
  const isAssistant = message.role === "assistant";
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const editRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (!editRef.current || !editing) return;
    const el = editRef.current;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  useLayoutEffect(() => {
    if (!editing) setEditContent(message.content);
  }, [message.content, editing]);

  const handleSaveEdit = useCallback(() => {
    if (!onEdit(message.localId, editContent)) return;
    setEditing(false);
    useChatUiStore.getState().focusComposer();
  }, [message.localId, editContent, onEdit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        handleSaveEdit();
      } else if (e.key === "Escape") {
        setEditing(false);
        useChatUiStore.getState().focusComposer();
      }
    },
    [handleSaveEdit],
  );

  const canSwipe = siblingTotal > 1;
  const canNext = siblingIndex < siblingTotal - 1;
  // Only the newest message may regenerate: an older assistant message would
  // branch and hide the rest of the conversation.
  const isNewestAssistant = isAssistant && isNewest;

  const name = isAssistant ? characterName : isUser ? userName : "";
  const displayContent = isStreaming ? streamingText || message.content : message.content;
  // Streaming chunks often end mid-token; balance before markdown render so
  // morphdom patches a well-formed tree instead of flickering on broken HTML.
  // Copy still uses the raw text.
  const renderContent =
    isStreaming && streamingText ? balanceMarkdown(streamingText, false) : displayContent;

  if (isSystem) {
    return (
      <div
        className={cn(
          "my-2 flex items-center gap-3 text-xs uppercase tracking-widest text-2",
          isNewest && "motion-safe:animate-msg-in",
        )}
      >
        <div className="h-px flex-1 bg-raised" />
        <span className="shrink-0">{displayContent}</span>
        <div className="h-px flex-1 bg-raised" />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "group relative rounded-2xl px-4 py-3.5 md:px-5 md:py-4",
          isAssistant ? "message-glass-strong border-l-2 border-brand/40" : "message-glass",
          isNewest && "motion-safe:animate-msg-in",
        )}
        inert={synthetic || undefined}
      >
        <div className="flex gap-3">
          <Avatar className="size-8 shrink-0">
            <AvatarImage src={avatarSrc ?? undefined} alt={name} className="object-cover" />
            <AvatarFallback
              className={cn(
                "rounded-full text-sm",
                isAssistant ? "bg-brand/20 text-brand" : "bg-raised text-2",
              )}
            >
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm font-semibold tracking-wide",
                  isAssistant ? "text-brand" : "text-2",
                )}
              >
                {name}
              </span>
              {!synthetic && (
                <span
                  className={cn(
                    "ml-auto flex shrink-0 items-center gap-0.5 transition-opacity",
                    "opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100",
                    "motion-reduce:transition-none",
                    disabled && "pointer-events-none",
                  )}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-2 hover:text-1"
                    onClick={() => {
                      void navigator.clipboard.writeText(displayContent).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      });
                    }}
                    aria-label={copied ? "Copied" : "Copy message"}
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-2 hover:text-1"
                    onClick={() => {
                      setEditContent(message.content);
                      setEditing(true);
                    }}
                    aria-label="Edit message"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-2 hover:text-danger"
                    onClick={() => setDeleteOpen(true)}
                    aria-label="Delete message"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </span>
              )}
            </div>

            {editing ? (
              <div>
                <Textarea
                  ref={editRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  aria-label="Edit message"
                  className="min-h-[60px] resize-none rounded-lg border-0 bg-raised p-3 text-sm leading-6 text-foreground ring-1 ring-(--border-subtle) focus-visible:ring-1 focus-visible:ring-brand/60"
                  style={{ maxHeight: TEXTAREA_MAX_HEIGHT }}
                />
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 gap-1 text-xs"
                    onClick={handleSaveEdit}
                  >
                    <Check className="size-3" data-icon="inline-start" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-2"
                    onClick={() => {
                      setEditing(false);
                      useChatUiStore.getState().focusComposer();
                    }}
                  >
                    Cancel
                  </Button>
                  <span className="ml-auto text-xs text-3">Ctrl/⌘+Enter</span>
                </div>
              </div>
            ) : isStreaming && !streamingText ? (
              <div className="flex items-center gap-1 h-7">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-1.5 rounded-full bg-brand animate-bounce motion-reduce:animate-none"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-sm leading-6" dir="auto">
                {displayContent.trim() || isStreaming ? (
                  <RichText
                    content={renderContent}
                    className={cn(
                      "md:max-w-[72ch]",
                      isStreaming && streamingText && "rt-mes-text-streaming",
                    )}
                  />
                ) : (
                  <span className="text-3 italic">Empty message</span>
                )}
              </div>
            )}
          </div>
        </div>

        {!synthetic && (canSwipe || isNewestAssistant) ? (
          <div
            className={cn(
              "mt-2 flex items-center justify-end gap-1",
              disabled && "pointer-events-none opacity-40",
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-2 hover:text-1 disabled:opacity-20"
              disabled={siblingIndex <= 0}
              onClick={() => onSwipe(message.localId, "prev")}
              aria-label="Previous response"
            >
              <ChevronLeft className="size-4" />
            </Button>

            {canSwipe && (
              <span className="min-w-[2.5rem] text-center text-xs tabular-nums text-2 select-none">
                {siblingIndex + 1}/{siblingTotal}
              </span>
            )}

            {canNext && (
              <Button
                variant="ghost"
                size="icon"
                className="size-9 text-2 hover:text-1 disabled:opacity-20"
                onClick={() => onSwipe(message.localId, "next")}
                aria-label="Next response"
              >
                <ChevronRight className="size-4" />
              </Button>
            )}

            {isNewestAssistant && (
              <Button
                variant="ghost"
                size="icon"
                className="size-9 text-2 hover:text-brand"
                onClick={() => onRegenerate(message.localId)}
                aria-label="Regenerate response"
              >
                <RotateCw className="size-4" />
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes this message and all messages after it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                if (!onDelete(message.localId)) event.preventDefault();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
