import { useState, useLayoutEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, RotateCw, Pencil, Trash2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadsUrl } from "@/lib/uploads-url";
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
import { cn } from "@/lib/utils";
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
  onSwipe: (messageLocalId: number, direction: "next" | "prev") => void;
  onRegenerate: (messageLocalId: number) => void;
  onEdit: (messageLocalId: number, content: string) => void;
  onDelete: (messageLocalId: number) => void;
}

export function ChatMessage({
  entry,
  isStreaming,
  streamingText,
  isNewest,
  characterName,
  userName,
  avatarSrc,
  disabled,
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
  const [expanded, setExpanded] = useState(false);

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
    onEdit(message.localId, editContent);
    setEditing(false);
  }, [message.localId, editContent, onEdit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        handleSaveEdit();
      } else if (e.key === "Escape") {
        setEditing(false);
      }
    },
    [handleSaveEdit],
  );

  const canSwipe = siblingTotal > 1;
  const isLastAssistant = isAssistant && !(siblingIndex < siblingTotal - 1);

  const name = isAssistant ? characterName : isUser ? userName : "";
  const displayContent = isStreaming
    ? streamingText || message.content
    : message.content;
  const isLongMessage = displayContent.length > 600;

  if (isSystem) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground/50 my-2",
          isNewest && "motion-safe:animate-msg-in",
        )}
      >
        <div className="h-px flex-1 bg-white/5" />
        <span className="shrink-0">{displayContent}</span>
        <div className="h-px flex-1 bg-white/5" />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "group relative rounded-2xl px-4 py-3.5 md:px-5 md:py-4",
          isAssistant ? "glass-strong border-l-2 border-[--lagoon]/40" : "glass",
          isNewest && "motion-safe:animate-msg-in",
        )}
      >
        <div className="flex gap-3">
          <Avatar className="size-8 shrink-0">
            <AvatarImage
              src={uploadsUrl(avatarSrc) ?? undefined}
              alt={name}
              className="object-cover"
            />
            <AvatarFallback
              className={cn(
                "rounded-lg text-sm",
                isAssistant ? "bg-[--lagoon]/20 text-[--lagoon]" : "bg-white/10 text-[--sea-ink-soft]",
              )}
            >
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={cn(
                  "text-sm font-semibold tracking-wide truncate",
                  isAssistant ? "text-[--lagoon]" : "text-[--sea-ink-soft]",
                )}
              >
                {name}
              </span>
              <span className={cn(
                "ml-auto flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity shrink-0",
                disabled && "pointer-events-none",
              )}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-white/40 hover:text-white"
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
                  className="size-6 text-white/40 hover:text-white"
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
                  className="size-6 text-white/40 hover:text-red-400"
                  onClick={() => setDeleteOpen(true)}
                  aria-label="Delete message"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </div>

            {editing ? (
              <div>
                <Textarea
                  ref={editRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[60px] resize-none border-0 bg-transparent p-0 text-sm leading-6 text-foreground focus-visible:ring-0"
                  style={{ maxHeight: TEXTAREA_MAX_HEIGHT }}
                />
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 gap-1 text-xs"
                    onClick={handleSaveEdit}
                  >
                    <Check className="size-3" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    ⌘+Enter
                  </span>
                </div>
              </div>
            ) : isStreaming && !streamingText ? (
              <div className="flex items-center gap-1 h-7">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-1.5 rounded-full bg-[--lagoon] animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            ) : (
              <div>
                <div
                  className={cn(
                    "text-sm leading-6",
                    !expanded && isLongMessage && "line-clamp-[10]",
                  )}
                >
                  <RichText content={displayContent} />
                  {isStreaming && streamingText && (
                    <span className="inline-block w-[2px] h-[1.15em] bg-[--lagoon] animate-pulse align-baseline ml-0.5" />
                  )}
                </div>
                {isLongMessage && !isStreaming && (
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-1 text-[11px] text-[--lagoon]/70 hover:text-[--lagoon] transition-colors"
                  >
                    {expanded ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {canSwipe || isLastAssistant ? (
          <div className={cn(
            "mt-2 flex items-center justify-end gap-1",
            disabled && "pointer-events-none opacity-40",
          )}>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-white/30 hover:text-white disabled:opacity-20"
              disabled={siblingIndex <= 0}
              onClick={() => onSwipe(message.localId, "prev")}
              aria-label="Previous response"
            >
              <ChevronLeft className="size-4" />
            </Button>

            {canSwipe && (
              <span className="min-w-[2.5rem] text-center text-[11px] tabular-nums text-white/40 select-none">
                {siblingIndex + 1}/{siblingTotal}
              </span>
            )}

            {isLastAssistant ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-white/30 hover:text-[--lagoon]"
                onClick={() => onRegenerate(message.localId)}
                aria-label="Regenerate response"
              >
                <RotateCw className="size-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-white/30 hover:text-white disabled:opacity-20"
                disabled={siblingIndex >= siblingTotal - 1}
                onClick={() => onSwipe(message.localId, "next")}
                aria-label="Next response"
              >
                <ChevronRight className="size-4" />
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
              This deletes this message and all messages after it. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(message.localId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
