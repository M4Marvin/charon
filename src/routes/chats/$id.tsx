import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useChat,
  useChatMessages,
  useDeleteChat,
  useRegenerateMessage,
  useSendMessage,
  useSwipeMessage,
} from "@/hooks/useChats";
import type { ChatMessageRow } from "@/db/schema";
import type { ChatMessage } from "@/lib/st-core/shared/types";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getActivePath, getSiblings } from "@/lib/st-core/chat-tree/tree";

export const Route = createFileRoute("/chats/$id")({
  component: ChatPage,
});

function rowToMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.localId,
    parent_id: row.parentLocalId,
    children: row.children ?? [],
    selected_child_id: row.selectedChildLocalId,
    role: row.role,
    name: row.name ?? undefined,
    content: row.content,
    is_user: row.isUser ?? undefined,
    is_system: row.isSystem ?? undefined,
    extra: row.extra ?? undefined,
  };
}

interface PathEntry {
  message: ChatMessage;
  hasSiblings: boolean;
  siblingIndex: number;
  siblingTotal: number;
}

function ChatPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: chat, isLoading: chatLoading, error: chatError } = useChat(id);
  const { data: messages, isLoading: msgsLoading } = useChatMessages(id);
  const sendMutation = useSendMessage();
  const regenerateMutation = useRegenerateMessage();
  const swipeMutation = useSwipeMessage();
  const deleteMutation = useDeleteChat();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activePath: PathEntry[] = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    const msgs = messages.map(rowToMessage);
    const tree = treeFromNodes(msgs);
    const path = getActivePath(tree);
    return path.map((msg) => {
      const siblings = getSiblings(tree, msg.id);
      const idx = siblings.findIndex((s) => s.id === msg.id);
      return {
        message: msg,
        hasSiblings: siblings.length > 1,
        siblingIndex: idx,
        siblingTotal: siblings.length,
      };
    });
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate({ chatId: id, content: trimmed });
  }, [input, id, sendMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleSwipe = useCallback(
    (direction: "next" | "prev") => {
      if (swipeMutation.isPending) return;
      swipeMutation.mutate({ chatId: id, direction });
    },
    [id, swipeMutation],
  );

  const handleRegenerate = useCallback(() => {
    if (regenerateMutation.isPending) return;
    regenerateMutation.mutate({ chatId: id });
  }, [id, regenerateMutation]);

  const handleDelete = useCallback(() => {
    if (!window.confirm(`Delete this chat?`)) return;
    deleteMutation.mutate(
      { id },
      { onSuccess: () => void navigate({ to: "/chats" }) },
    );
  }, [id, deleteMutation, navigate]);

  const isLoading = chatLoading || msgsLoading;

  if (isLoading) {
    return (
      <main className="mx-auto flex max-w-3xl items-center justify-center px-4 py-16">
        <p className="text-muted-foreground text-sm">Loading chat...</p>
      </main>
    );
  }

  if (chatError || !chat) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-destructive text-sm">
          {chatError?.message ?? "Chat not found"}
        </p>
        <Button asChild variant="ghost" className="mt-4">
          <Link to="/chats">← Back to chats</Link>
        </Button>
      </main>
    );
  }

  return (
    <div className="mx-auto flex h-dvh max-w-4xl flex-col px-4">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b py-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/chats">←</Link>
        </Button>
        <Avatar className="size-8">
          {chat.characterImagePath ? (
            <AvatarImage
              src={`/api/characters/${chat.characterId}/avatar`}
              alt={chat.characterName}
            />
          ) : null}
          <AvatarFallback className="text-xs">{chat.characterName[0]}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{chat.title}</p>
          <p className="text-muted-foreground truncate text-xs">
            with {chat.characterName}
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          Delete
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto py-4">
        {activePath.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">No messages yet.</p>
          </div>
        ) : (
          activePath.map((entry, index) => (
            <MessageBubble
              key={entry.message.id}
              entry={entry}
              isLast={index === activePath.length - 1}
              characterName={chat.characterName}
              characterImagePath={chat.characterImagePath}
              characterId={chat.characterId}
              onSwipe={handleSwipe}
              onRegenerate={handleRegenerate}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex shrink-0 items-end gap-2 border-t py-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
          className="min-h-[40px] flex-1 resize-none"
          rows={1}
          disabled={sendMutation.isPending}
        />
        <Button onClick={handleSend} disabled={!input.trim() || sendMutation.isPending}>
          {sendMutation.isPending ? "..." : "Send"}
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({
  entry,
  isLast,
  characterName,
  characterImagePath,
  characterId,
  onSwipe,
  onRegenerate,
}: {
  entry: PathEntry;
  isLast: boolean;
  characterName: string;
  characterImagePath: string | null;
  characterId: string;
  onSwipe: (direction: "next" | "prev") => void;
  onRegenerate: () => void;
}) {
  const { message, hasSiblings, siblingIndex, siblingTotal } = entry;
  const isUser = message.is_user ?? message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[80%] gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
        {/* Avatar */}
        <Avatar className={`mt-1 size-8 shrink-0 ${isUser ? "hidden" : ""}`}>
          {characterImagePath ? (
            <AvatarImage
              src={`/api/characters/${characterId}/avatar`}
              alt={characterName}
            />
          ) : null}
          <AvatarFallback className="text-xs">{characterName[0]}</AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="space-y-1">
          <p
            className={`text-muted-foreground text-xs ${isUser ? "text-right" : ""}`}
          >
            {isUser ? "You" : characterName}
          </p>
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm ${
              isUser
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-muted rounded-bl-md"
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>

          {/* Swipe arrows + Regenerate */}
          {isLast && !isUser && hasSiblings ? (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onSwipe("prev")}
                disabled={siblingIndex === 0}
                className={`text-muted-foreground hover:text-foreground text-xs transition-colors disabled:opacity-30 ${
                  siblingIndex === 0 ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                ◀
              </button>
              <span className="text-muted-foreground text-xs">
                {siblingIndex + 1}/{siblingTotal}
              </span>
              <button
                type="button"
                onClick={() => onSwipe("next")}
                disabled={siblingIndex === siblingTotal - 1}
                className={`text-muted-foreground hover:text-foreground text-xs transition-colors disabled:opacity-30 ${
                  siblingIndex === siblingTotal - 1
                    ? "cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >
                ▶
              </button>
              <span className="text-muted-foreground mx-1 text-xs">·</span>
              <button
                type="button"
                onClick={onRegenerate}
                className="text-muted-foreground hover:text-foreground cursor-pointer text-xs transition-colors"
              >
                Regenerate
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
