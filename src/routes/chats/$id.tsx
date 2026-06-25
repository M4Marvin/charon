import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useChat as useAiChat, fetchServerSentEvents } from "@tanstack/ai-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useChat,
  useChatMessages,
  useDeleteChat,
  useDeleteMessage,
  useEditMessage,
  usePrepareStream,
  useFinalizeStream,
  useCancelStream,
  useSwipeMessage,
  useSendMessage,
} from "@/hooks/useChats";


import { ChatSettingsPanel } from "@/components/ChatSettingsPanel";
import { useChatStore } from "@/stores/chat-store";
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
  siblingIndex: number;
  siblingTotal: number;
  isDraft: boolean;
  isStreaming: boolean;
}

function ChatPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: chat, isLoading: chatLoading, error: chatError } = useChat(id);
  const { data: messages, isLoading: msgsLoading } = useChatMessages(id);

  const prepareStream = usePrepareStream();
  const finalizeStream = useFinalizeStream();
  const cancelStream = useCancelStream();
  const sendMessageMutation = useSendMessage();
  const deleteMessageMutation = useDeleteMessage();
  const editMessageMutation = useEditMessage();
  const deleteChatMutation = useDeleteChat();
  const swipeMutation = useSwipeMessage();

  // ── Chat store: replaces 5 useState + 3 useRef ──────────────────────
  const settingsOpen = useChatStore((s) => s.settingsOpen);
  const input = useChatStore((s) => s.input);
  const activePlaceholderId = useChatStore((s) => s.activePlaceholderId);
  const setSettingsOpen = useChatStore((s) => s.setSettingsOpen);
  const setInput = useChatStore((s) => s.setInput);
  const clearInput = useChatStore((s) => s.clearInput);
  const setPlaceholder = useChatStore((s) => s.setPlaceholder);
  const clearPlaceholder = useChatStore((s) => s.clearPlaceholder);
  const markRecovered = useChatStore((s) => s.markRecovered);
  const recoveredFor = useChatStore((s) => s.recoveredFor);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedProviderId = chat?.providerId ?? "";
  const selectedModel = chat?.selectedModel ?? "";

  const hasAi = selectedProviderId.length > 0 && selectedModel.length > 0;
  const canSend = activePlaceholderId === null;

  // Streaming connection — body reads from the store synchronously. No more
  // ref + useEffect sync race: getState() always returns the current value.
  const connection = useMemo(
    () =>
      fetchServerSentEvents("/api/chat-generate", () => ({
        body: { chatId: id, assistantMessageLocalId: useChatStore.getState().activePlaceholderId ?? 0 },
      })),
    [id],
  );

  const aiChat = useAiChat({
    connection,
    onFinish: () => {
      const placeholderId = useChatStore.getState().activePlaceholderId;
      const msgs = aiChat.messages;
      const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
      const content = lastAssistant
        ? lastAssistant.parts.map((p) => (p.type === "text" ? p.content : "")).join("")
        : "";
      console.log("[stream][onFinish]", {
        placeholderId,
        msgsLen: msgs.length,
        assistantContentLen: content.length,
      });
      if (!placeholderId) return;
      if (content) {
        finalizeStream.mutate(
          { chatId: id, messageLocalId: placeholderId, content },
          {
            onSuccess: () => clearPlaceholder(),
            onError: (e) => toast.error(`Save failed: ${(e as Error).message}`),
          },
        );
      } else {
        cancelStream.mutate(
          { chatId: id, messageLocalId: placeholderId },
          { onSuccess: () => clearPlaceholder() },
        );
      }
    },
    onError: (err) => {
      console.error("[stream][onError]", {
        message: err.message,
        name: err.name,
        stack: err.stack,
        cause: (err as { cause?: unknown }).cause,
      });
      const causeStr = (() => {
        const c = (err as { cause?: unknown }).cause;
        if (!c) return "";
        if (c instanceof Error) return ` — ${c.message}`;
        return ` — ${JSON.stringify(c)}`;
      })();
      toast.error(`Stream error: ${err.message}${causeStr}`);
      const placeholderId = useChatStore.getState().activePlaceholderId;
      if (placeholderId) {
        cancelStream.mutate(
          { chatId: id, messageLocalId: placeholderId },
          { onSuccess: () => clearPlaceholder() },
        );
      }
    },
  });

  // Live in-flight assistant text. Drives B1 (visible streaming): shown in
  // place of the (empty) DB content while the placeholder is active.
  const liveAssistantText = useMemo(() => {
    if (activePlaceholderId === null) return null;
    const msgs = aiChat.messages;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]!;
      if (m.role !== "assistant") continue;
      const text = m.parts
        .map((p) => (p.type === "text" ? p.content : ""))
        .join("");
      if (text.length > 0) return text;
    }
    return null;
  }, [aiChat.messages, activePlaceholderId]);

  // Active path
  const activePath: PathEntry[] = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    const tree = treeFromNodes(messages.map(rowToMessage));
    const path = getActivePath(tree);
    return path
      .filter((msg) => msg.role !== "system")
      .map((msg) => {
        const siblings = getSiblings(tree, msg.id);
        const idx = siblings.findIndex((s) => s.id === msg.id);
        const isStreaming = msg.id === activePlaceholderId;
        const baseMessage = isStreaming && liveAssistantText !== null
          ? { ...msg, content: liveAssistantText }
          : msg;
        return {
          message: baseMessage,
          siblingIndex: idx,
          siblingTotal: siblings.length,
          isDraft: (msg.extra?.isDraft ?? false) === true,
          isStreaming,
        };
      });
  }, [messages, activePlaceholderId, liveAssistantText]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Stale isStreaming recovery (B3). Runs once per chat id: on mount, if the
  // DB has any message with extra.isStreaming, mark it for cancellation.
  useEffect(() => {
    if (recoveredFor === id) return;
    if (!messages) return;
    const stale = messages.find((m) => (m.extra?.isStreaming ?? false) === true);
    if (!stale) {
      // Nothing to recover, but mark this chat id as visited so we don't
      // re-scan on every messages refetch.
      markRecovered(id, 0);
      return;
    }
    markRecovered(id, stale.localId);
    cancelStream.mutate({ chatId: id, messageLocalId: stale.localId });
    // We intentionally do NOT set activePlaceholderId — the placeholder was
    // never displayed in this session, so the user doesn't see a ghost.
  }, [messages, id, recoveredFor, cancelStream, markRecovered]);

  // Clean up the recovered-marker when navigating to a different chat.
  useEffect(() => {
    return () => {
      // On unmount, do not clear activePlaceholderId — the user might be
      // navigating away mid-stream and we'd want the same behaviour as
      // before (the DB stays dirty, next mount will recover it). Actually
      // this is fine because on the next mount the new chat id will
      // differ and the recovery effect will run for that new chat.
    };
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !canSend) return;
    clearInput();
    if (!hasAi) {
      sendMessageMutation.mutate(
        { chatId: id, content: trimmed },
        { onError: (e) => toast.error(`Send error: ${(e as Error).message}`) },
      );
      return;
    }
    prepareStream.mutate(
      { chatId: id, mode: "send", content: trimmed },
      {
        onSuccess: (result) => {
          console.log("[send] prepareStream success", {
            placeholderId: result.assistantMessageLocalId,
            contentLen: trimmed.length,
          });
          // Synchronous store update: the connection body reads
          // getState().activePlaceholderId and will see this value when
          // aiChat.sendMessage fires its fetch — no effect-lag race.
          setPlaceholder(result.assistantMessageLocalId);
          void aiChat.sendMessage(trimmed);
        },
        onError: (e) => {
          console.error("[send] prepareStream error", e);
          toast.error(`Send error: ${(e as Error).message}`);
        },
      },
    );
  }, [input, canSend, hasAi, id, prepareStream, sendMessageMutation, aiChat, setPlaceholder, clearInput]);

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
    (messageLocalId: number, direction: "next" | "prev") => {
      console.log("[swipe] entry", {
        id,
        messageLocalId,
        direction,
        activePlaceholderId,
        hasAi,
      });
      if (activePlaceholderId !== null) return;
      if (direction === "prev") {
        console.log("[swipe] → prev", { messageLocalId });
        swipeMutation.mutate({ chatId: id, messageLocalId, direction });
        return;
      }
      // Next on assistant → cycle through existing siblings, regenerate only
      // when at the last one. Greeting regenerate uses sendMessage(".") because
      // aiChat.reload() silently no-ops without a prior user turn, and the
      // client guards against whitespace-only content (see chat-client.js:548).
      const entry = activePath.find((p) => p.message.id === messageLocalId);
      if (entry) {
        console.log("[swipe] entry resolved", {
          isUser: entry.message.is_user,
          parentId: entry.message.parent_id,
          siblingIndex: entry.siblingIndex,
          siblingTotal: entry.siblingTotal,
          isStreaming: entry.isStreaming,
        });
      }
      if (entry && !entry.message.is_user && messageLocalId !== 0) {
        if (entry.isStreaming) {
          toast.error("Wait for the current response to finish");
          return;
        }
        if (!hasAi) {
          console.log("[swipe] → no-ai-fallback", { messageLocalId });
          // No AI configured: fall back to default-reply sibling ("Make your
          // own greeting!" for greetings, pickDefaultReply otherwise).
          swipeMutation.mutate({ chatId: id, messageLocalId, direction });
          return;
        }
        if (entry.siblingIndex < entry.siblingTotal - 1) {
          console.log("[swipe] → cycle", { messageLocalId });
          // Cycle to existing next sibling instead of generating a new one.
          swipeMutation.mutate({ chatId: id, messageLocalId, direction });
          return;
        }
        const isGreeting = entry.message.parent_id === 0;
        console.log("[swipe] → regen", { messageLocalId, isGreeting });
        prepareStream.mutate(
          { chatId: id, mode: "regenerate", messageLocalId },
          {
            onSuccess: (result) => {
              console.log("[swipe] prepareStream success", {
                messageLocalId,
                placeholderId: result.assistantMessageLocalId,
                isGreeting,
              });
              setPlaceholder(result.assistantMessageLocalId);
              // Greeting = parent_id 0 = no preceding user message; reload()
              // would no-op. sendMessage(".") triggers the stream (non-whitespace
              // required to bypass chat-client.js:548 trim guard) and the server
              // builds the greeting prompt from the root.
              if (isGreeting) {
                console.log("[swipe] → aiChat.sendMessage(\".\")", {
                  placeholderId: result.assistantMessageLocalId,
                });
                void aiChat.sendMessage(".");
              } else {
                console.log("[swipe] → aiChat.reload()", {
                  placeholderId: result.assistantMessageLocalId,
                });
                void aiChat.reload();
              }
            },
            onError: (e) => {
              console.error("[swipe] prepareStream error", e);
              toast.error(`Regenerate error: ${(e as Error).message}`);
            },
          },
        );
        return;
      }
      // Next on user → default swipe (draft)
      console.log("[swipe] → user-draft", { messageLocalId });
      swipeMutation.mutate({ chatId: id, messageLocalId, direction });
    },
    [id, swipeMutation, prepareStream, activePlaceholderId, activePath, aiChat, setPlaceholder, hasAi],
  );

  const handleDeleteMessage = useCallback(
    (messageLocalId: number) => {
      if (activePlaceholderId !== null) return;
      if (!window.confirm("Delete this message and all replies below it?")) return;
      deleteMessageMutation.mutate({ chatId: id, messageLocalId });
    },
    [id, deleteMessageMutation, activePlaceholderId],
  );

  const handleEditMessage = useCallback(
    (messageLocalId: number, content: string) => {
      if (activePlaceholderId !== null) return;
      editMessageMutation.mutate({ chatId: id, messageLocalId, content });
    },
    [id, editMessageMutation, activePlaceholderId],
  );

  const handleDeleteChat = useCallback(() => {
    if (!window.confirm("Delete chat?")) return;
    deleteChatMutation.mutate(
      { id },
      { onSuccess: () => void navigate({ to: "/chats" }) },
    );
  }, [id, deleteChatMutation, navigate]);

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
        <p className="text-destructive text-sm">{chatError?.message ?? "Chat not found"}</p>
        <Button asChild variant="ghost" className="mt-4">
          <Link to="/chats">← Back to chats</Link>
        </Button>
      </main>
    );
  }

  return (
    <div className="flex h-dvh">
      {/* Main chat area */}
      <div className="mx-auto flex max-w-4xl flex-1 flex-col px-4">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b py-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/chats">←</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(!settingsOpen)}
            aria-label="Toggle settings panel"
          >
            {settingsOpen ? "✕ Settings" : "⚙ Settings"}
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
            <p className="text-muted-foreground truncate text-xs">with {chat.characterName}</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleDeleteChat}>
            Delete
          </Button>
        </div>

        {!selectedProviderId && (
          <div className="bg-muted/50 mx-2 mt-2 rounded-lg px-4 py-2 text-center text-xs">
            Configure an AI provider in the{" "}
            <button type="button" className="underline" onClick={() => setSettingsOpen(true)}>
              settings panel
            </button>{" "}
            to start chatting.
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          {activePath.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground text-sm">
                No messages yet. Start a conversation!
              </p>
            </div>
          ) : (
            activePath.map((entry) => (
              <MessageBubble
                key={entry.message.id}
                entry={entry}
                characterName={chat.characterName}
                characterImagePath={chat.characterImagePath}
                characterId={chat.characterId}
                onSwipe={handleSwipe}
                onDelete={handleDeleteMessage}
                onEdit={handleEditMessage}
                disabled={activePlaceholderId !== null}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex shrink-0 items-end gap-2 border-t py-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activePlaceholderId
                ? "Waiting for response..."
                : "Type a message... (Enter to send, Shift+Enter for newline)"
            }
            className="min-h-[40px] flex-1 resize-none"
            rows={1}
            disabled={!canSend}
          />
          <Button onClick={handleSend} disabled={!canSend || !input.trim()}>
            {activePlaceholderId ? "..." : "Send"}
          </Button>
        </div>
      </div>

      {settingsOpen && (
        <ChatSettingsPanel chat={chat} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

function MessageBubble({
  entry,
  characterName,
  characterImagePath,
  characterId,
  onSwipe,
  onDelete,
  onEdit,
  disabled,
}: {
  entry: PathEntry;
  characterName: string;
  characterImagePath: string | null;
  characterId: string;
  onSwipe: (messageLocalId: number, direction: "next" | "prev") => void;
  onDelete: (messageLocalId: number) => void;
  onEdit: (messageLocalId: number, content: string) => void;
  disabled: boolean;
}) {
  const { message, siblingIndex, siblingTotal, isDraft, isStreaming } = entry;
  const isUser = message.is_user ?? message.role === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(message.content);

  useEffect(() => {
    if (!isEditing) setDraftContent(message.content);
  }, [message.content, isEditing]);

  const beginEdit = () => {
    if (isDraft || disabled) return;
    setDraftContent(message.content);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraftContent(message.content);
    setIsEditing(false);
  };

  const saveEdit = () => {
    const trimmed = draftContent.trim();
    if (trimmed === message.content) {
      setIsEditing(false);
      return;
    }
    onEdit(message.id, trimmed);
    setIsEditing(false);
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[80%] gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
        <Avatar className={`mt-1 size-8 shrink-0 ${isUser ? "hidden" : ""}`}>
          {characterImagePath ? (
            <AvatarImage src={`/api/characters/${characterId}/avatar`} alt={characterName} />
          ) : null}
          <AvatarFallback className="text-xs">{characterName[0]}</AvatarFallback>
        </Avatar>

        <div className="space-y-1">
          <p className={`text-muted-foreground text-xs ${isUser ? "text-right" : ""}`}>
            {isUser ? "You" : characterName}
            {isStreaming && " ✦"}
          </p>
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm ${
              isUser
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-muted rounded-bl-md"
            } ${isDraft || isStreaming ? "opacity-50" : ""}`}
          >
            {isDraft ? (
              <p className="italic">Type your message...</p>
            ) : isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  className="min-h-[60px] resize-none text-sm"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveEdit}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">
                {message.content}
                {isStreaming && <span className="animate-pulse">▌</span>}
              </p>
            )}
          </div>

          {!isEditing && !isDraft && !isStreaming && !disabled ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onSwipe(message.id, "prev")}
                disabled={siblingIndex === 0}
                className={`text-muted-foreground hover:text-foreground text-xs transition-colors disabled:opacity-30 ${
                  siblingIndex === 0 ? "cursor-not-allowed" : "cursor-pointer"
                }`}
                aria-label="Previous message"
              >
                ◀
              </button>
              <span className="text-muted-foreground text-xs">
                {siblingIndex + 1}/{siblingTotal}
              </span>
              <button
                type="button"
                onClick={() => onSwipe(message.id, "next")}
                className="text-muted-foreground hover:text-foreground cursor-pointer text-xs transition-colors"
                aria-label="Next message"
              >
                ▶
              </button>
              <button
                type="button"
                onClick={beginEdit}
                className="text-muted-foreground hover:text-foreground cursor-pointer text-xs transition-colors"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(message.id)}
                className="text-muted-foreground hover:text-destructive cursor-pointer text-xs transition-colors"
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

