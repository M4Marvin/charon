import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useChat as useAiChat, fetchServerSentEvents } from "@tanstack/ai-react";
import { ArrowDown, ArrowLeft, ArrowUp, Settings, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useChat,
  useChatMessages,
  useDeleteChat,
  useDeleteMessage,
  useEditMessage,
  useImpersonateMessage,
  usePrepareStream,
  useFinalizeStream,
  useCancelStream,
  useSwipeMessage,
  useSendMessage,
} from "@/hooks/useChats";
import { useCharacter } from "@/hooks/useCharacters";
import { usePersonas, type PersonaListItem } from "@/hooks/usePersonas";
import { useUserSettings } from "@/hooks/useUserSettings";

import { ChatSettingsPanel } from "@/components/ChatSettingsPanel";
import { useChatStore } from "@/stores/chat-store";
import type { ChatMessageRow } from "@/db/schema";
import type { ChatMessage } from "@/lib/st-core/shared/types";
import { Streamdown } from "streamdown";
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

const TEXTAREA_MAX_HEIGHT = 160;

function ChatPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: chat, isLoading: chatLoading, error: chatError } = useChat(id);
  const { data: messages, isLoading: msgsLoading } = useChatMessages(id);
  const { data: character } = useCharacter(chat?.characterId ?? "");
  const { data: personas = [] } = usePersonas();
  const { data: userSettings } = useUserSettings();

  const prepareStream = usePrepareStream();
  const finalizeStream = useFinalizeStream();
  const cancelStream = useCancelStream();
  const sendMessageMutation = useSendMessage();
  const deleteMessageMutation = useDeleteMessage();
  const editMessageMutation = useEditMessage();
  const deleteChatMutation = useDeleteChat();
  const swipeMutation = useSwipeMessage();
  const impersonateMutation = useImpersonateMessage();

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const isUserScrolledUpRef = useRef(false);
  const [isImpersonating, setIsImpersonating] = useState(false);

  const selectedProviderId = chat?.providerId ?? "";
  const selectedModel = chat?.selectedModel ?? "";

  const hasAi = selectedProviderId.length > 0 && selectedModel.length > 0;
  const canSend = activePlaceholderId === null;
  const isStreaming = activePlaceholderId !== null;

  const activePersona: PersonaListItem | undefined = useMemo(() => {
    const id = userSettings?.defaultPersonaId;
    if (!id) return undefined;
    return personas.find((p) => p.id === id);
  }, [userSettings?.defaultPersonaId, personas]);

  // Streaming connection — body reads from the store synchronously. No more
  // ref + useEffect sync race: getState() always returns the current value.
  const connection = useMemo(
    () =>
      fetchServerSentEvents("/api/chat-generate", () => ({
        body: {
          chatId: id,
          assistantMessageLocalId: useChatStore.getState().activePlaceholderId ?? 0,
        },
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
      const text = m.parts.map((p) => (p.type === "text" ? p.content : "")).join("");
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
        const isStreamingLocal = msg.id === activePlaceholderId;
        const baseMessage =
          isStreamingLocal && liveAssistantText !== null
            ? { ...msg, content: liveAssistantText }
            : msg;
        return {
          message: baseMessage,
          siblingIndex: idx,
          siblingTotal: siblings.length,
          isDraft: (msg.extra?.isDraft ?? false) === true,
          isStreaming: isStreamingLocal,
        };
      });
  }, [messages, activePlaceholderId, liveAssistantText]);

  // Auto-scroll to bottom on new messages, unless the user has scrolled up.
  useEffect(() => {
    if (isUserScrolledUpRef.current && !isStreaming) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activePath, isStreaming]);

  // Auto-grow composer textarea (cap at TEXTAREA_MAX_HEIGHT px).
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
  }, [input]);

  // Scroll listener — shows the jump-to-bottom FAB when the user is more
  // than ~200px away from the bottom. Skipped during active streaming
  // (we auto-scroll new tokens into view).
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const up = distance > 200;
    isUserScrolledUpRef.current = up;
    setShowScrollFab(up);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    isUserScrolledUpRef.current = false;
    setShowScrollFab(false);
  }, []);

  // Stale isStreaming recovery (B3). Runs once per chat id: on mount, if the
  // DB has any message with extra.isStreaming, mark it for cancellation.
  useEffect(() => {
    if (recoveredFor === id) return;
    if (!messages) return;
    const stale = messages.find((m) => (m.extra?.isStreaming ?? false) === true);
    if (!stale) {
      markRecovered(id, 0);
      return;
    }
    markRecovered(id, stale.localId);
    cancelStream.mutate({ chatId: id, messageLocalId: stale.localId });
  }, [messages, id, recoveredFor, cancelStream, markRecovered]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!canSend) return;
    clearInput();

    if (!trimmed) {
      // Empty send → continue from the active leaf: generate a response
      // for the last user message or regenerate the last assistant.
      if (!hasAi || activePath.length === 0) return;
      prepareStream.mutate(
        { chatId: id, mode: "continue" },
        {
          onSuccess: (result) => {
            console.log("[send] continue success", {
              placeholderId: result.assistantMessageLocalId,
            });
            setPlaceholder(result.assistantMessageLocalId);
            // "." sentinel triggers the stream; the server only injects
            // it into the prompt when there's zero user messages, which
            // our case doesn't match, so it's harmless.
            void aiChat.sendMessage(".");
          },
          onError: (e) => {
            console.error("[send] continue error", e);
            toast.error(`Continue error: ${(e as Error).message}`);
          },
        },
      );
      return;
    }

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
          setPlaceholder(result.assistantMessageLocalId);
          void aiChat.sendMessage(trimmed);
        },
        onError: (e) => {
          console.error("[send] prepareStream error", e);
          toast.error(`Send error: ${(e as Error).message}`);
        },
      },
    );
  }, [
    input,
    canSend,
    hasAi,
    activePath.length,
    id,
    prepareStream,
    sendMessageMutation,
    aiChat,
    setPlaceholder,
    clearInput,
  ]);

  const handleImpersonate = useCallback(() => {
    if (!canSend || isImpersonating || !hasAi || activePath.length === 0) return;
    setIsImpersonating(true);
    impersonateMutation.mutate(
      { chatId: id },
      {
        onSuccess: (result) => {
          setInput(result.text);
          setIsImpersonating(false);
        },
        onError: (e) => {
          toast.error(`Impersonation error: ${(e as Error).message}`);
          setIsImpersonating(false);
        },
      },
    );
  }, [id, canSend, hasAi, activePath.length, impersonateMutation, setInput, isImpersonating]);

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
          swipeMutation.mutate({ chatId: id, messageLocalId, direction });
          return;
        }
        if (entry.siblingIndex < entry.siblingTotal - 1) {
          console.log("[swipe] → cycle", { messageLocalId });
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
              if (isGreeting) {
                void aiChat.sendMessage(".");
              } else {
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
      console.log("[swipe] → user-draft", { messageLocalId });
      swipeMutation.mutate({ chatId: id, messageLocalId, direction });
    },
    [
      id,
      swipeMutation,
      prepareStream,
      activePlaceholderId,
      activePath,
      aiChat,
      setPlaceholder,
      hasAi,
    ],
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
    if (!window.confirm("Delete this chat?")) return;
    deleteChatMutation.mutate({ id }, { onSuccess: () => void navigate({ to: "/chats" }) });
  }, [id, deleteChatMutation, navigate]);

  const isLoading = chatLoading || msgsLoading;

  if (isLoading) {
    return (
      <main className="flex h-dvh items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading chat...</p>
      </main>
    );
  }

  if (chatError || !chat) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-destructive text-sm">{chatError?.message ?? "Chat not found"}</p>
        <Button asChild variant="ghost" className="mt-4">
          <Link to="/chats">← Back to chats</Link>
        </Button>
      </main>
    );
  }

  const characterDescription = (character?.data?.description as string | undefined) ?? "";
  const characterTags = (character?.data?.tags as string[] | undefined) ?? [];

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* ── Fixed chat header ── */}
      <header className="bg-background/80 border-border/60 sticky top-0 z-30 flex h-14 shrink-0 items-center border-b backdrop-blur">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center px-3">
          <div className="flex items-center justify-start">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Back to chats"
            >
              <Link to="/chats">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-8 shrink-0">
              {chat.characterImagePath ? (
                <AvatarImage
                  src={`/api/characters/${chat.characterId}/avatar`}
                  alt={chat.characterName}
                />
              ) : null}
              <AvatarFallback className="text-xs">{chat.characterName[0]}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-center">
              <p className="truncate text-sm font-medium leading-tight">{chat.characterName}</p>
              {selectedModel ? (
                <p className="text-muted-foreground truncate text-[10px] leading-tight">
                  {selectedModel}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => setSettingsOpen(!settingsOpen)}
              aria-label="Toggle settings panel"
            >
              <Settings className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Message column ── */}
      <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
          {/* Character intro card (Chub-style first impression) */}
          {(characterDescription || characterTags.length > 0) && (
            <CharacterIntroCard
              name={chat.characterName}
              imagePath={chat.characterImagePath}
              characterId={chat.characterId}
              description={characterDescription}
              tags={characterTags}
            />
          )}

          {activePath.length === 0 ? (
            <div className="text-muted-foreground py-16 text-center text-sm">
              No messages yet. Say hello!
            </div>
          ) : (
            activePath.map((entry) => (
              <MessageBubble
                key={entry.message.id}
                entry={entry}
                characterName={chat.characterName}
                characterImagePath={chat.characterImagePath}
                characterId={chat.characterId}
                personaName={activePersona?.name}
                personaIconPath={activePersona?.iconPath ?? null}
                onSwipe={handleSwipe}
                onDelete={handleDeleteMessage}
                onEdit={handleEditMessage}
                disabled={activePlaceholderId !== null}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll-to-bottom FAB */}
        {showScrollFab && (
          <Button
            size="icon"
            variant="outline"
            onClick={scrollToBottom}
            aria-label="Scroll to latest"
            className={`bg-background/90 absolute right-4 bottom-4 z-20 size-9 rounded-full shadow-lg backdrop-blur ${
              isStreaming ? "animate-pulse" : ""
            }`}
          >
            <ArrowDown className="size-4" />
          </Button>
        )}
      </div>

      {/* ── Composer + AI hint ── */}
      <div className="bg-background/80 border-border/60 shrink-0 border-t px-4 pt-2 pb-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {!hasAi && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="text-muted-foreground hover:text-foreground self-start text-xs transition-colors"
            >
              No AI configured — open settings →
            </button>
          )}
          <div className="border-border/60 bg-muted/30 flex items-end gap-2 rounded-2xl border px-3 py-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activePlaceholderId
                  ? "Waiting for response..."
                  : activePersona
                    ? `Message as ${activePersona.name}...`
                    : "Type a message..."
              }
              className="min-h-[36px] flex-1 resize-none border-0 bg-transparent px-1 py-1 text-sm shadow-none focus-visible:ring-0"
              rows={1}
              disabled={!canSend}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleImpersonate}
              disabled={!canSend || isImpersonating || !hasAi || activePath.length === 0}
              className="size-8 shrink-0 rounded-full"
              aria-label="Impersonate user"
            >
              {isImpersonating ? (
                <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Sparkles className="size-4" />
              )}
            </Button>
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!canSend || (!input.trim() && (!hasAi || activePath.length === 0))}
              className="size-8 shrink-0 rounded-full"
              aria-label="Send message"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {settingsOpen && (
        <ChatSettingsPanel
          chat={chat}
          onClose={() => setSettingsOpen(false)}
          onDeleteChat={handleDeleteChat}
        />
      )}
    </div>
  );
}

function CharacterIntroCard({
  name,
  imagePath,
  characterId,
  description,
  tags,
}: {
  name: string;
  imagePath: string | null;
  characterId: string;
  description: string;
  tags: string[];
}) {
  return (
    <div className="bg-muted/30 border-border/40 flex items-start gap-4 rounded-2xl border p-4">
      <Avatar className="size-14 shrink-0">
        {imagePath ? (
          <AvatarImage src={`/api/characters/${characterId}/avatar`} alt={name} />
        ) : null}
        <AvatarFallback>{name[0]}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold">{name}</p>
        {description && (
          <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed">
            {description}
          </p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {tags.slice(0, 6).map((t) => (
              <span
                key={t}
                className="bg-background/60 text-muted-foreground rounded-full border px-2 py-0.5 text-[10px]"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  entry,
  characterName,
  characterImagePath,
  characterId,
  personaName,
  personaIconPath,
  onSwipe,
  onDelete,
  onEdit,
  disabled,
}: {
  entry: PathEntry;
  characterName: string;
  characterImagePath: string | null;
  characterId: string;
  personaName: string | undefined;
  personaIconPath: string | null;
  onSwipe: (messageLocalId: number, direction: "next" | "prev") => void;
  onDelete: (messageLocalId: number) => void;
  onEdit: (messageLocalId: number, content: string) => void;
  disabled: boolean;
}) {
  const { message, siblingIndex, siblingTotal, isDraft, isStreaming } = entry;
  const isUser = message.is_user ?? message.role === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(message.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) setDraftContent(message.content);
  }, [message.content, isEditing]);

  useLayoutEffect(() => {
    const ta = editRef.current;
    if (ta && isEditing) {
      ta.style.height = "0px";
      ta.style.height = `${Math.min(ta.scrollHeight, 400)}px`;
    }
  }, [draftContent, isEditing]);

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

  const displayName = isUser ? (personaName ?? "You") : characterName;
  const initial = (displayName ?? "?").charAt(0).toUpperCase();

  return (
    <div className={`group flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar className="size-7 shrink-0">
        {isUser ? (
          personaIconPath ? (
            <AvatarImage src={personaIconPath} alt={displayName} />
          ) : null
        ) : characterImagePath ? (
          <AvatarImage src={`/api/characters/${characterId}/avatar`} alt={displayName} />
        ) : null}
        <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
      </Avatar>

      <div className={`flex min-w-0 max-w-[85%] flex-col gap-1 ${isUser ? "items-end" : ""}`}>
        <p
          className={`text-muted-foreground flex items-center gap-1 text-[11px] ${
            isUser ? "justify-end" : ""
          }`}
        >
          <span className="font-medium">{displayName}</span>
          {isStreaming && <span aria-hidden>✦</span>}
        </p>

        {isDraft ? (
          <p className="text-muted-foreground text-sm italic">Type your message...</p>
        ) : isEditing ? (
          <div className="w-full space-y-2">
            <Textarea
              ref={editRef}
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              className="min-h-[40px] resize-none border-0 bg-transparent p-0 text-sm outline-none focus-visible:ring-0 prose prose-sm prose-invert max-w-none"
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
        ) : isStreaming && message.content === "" ? (
          <ThinkingDots />
        ) : (
          <div
            className={`prose prose-sm prose-invert max-w-none ${
              isDraft || isStreaming ? "opacity-90" : ""
            }`}
          >
            <Streamdown parseIncompleteMarkdown={isStreaming}>{message.content}</Streamdown>
            {isStreaming && <StreamingCaret />}
          </div>
        )}

        {!isEditing && !isDraft && !disabled && (
          <div
            className={`text-muted-foreground flex items-center gap-2 pt-0.5 text-[11px] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
              isUser ? "flex-row-reverse" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onSwipe(message.id, "prev")}
              disabled={siblingIndex === 0}
              className="hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Previous message"
            >
              ‹
            </button>
            <span aria-label={`Message ${siblingIndex + 1} of ${siblingTotal}`}>
              {siblingIndex + 1}/{siblingTotal}
            </span>
            <button
              type="button"
              onClick={() => onSwipe(message.id, "next")}
              className="hover:text-foreground"
              aria-label="Next message"
            >
              ›
            </button>
            {!isUser && (
              <>
                <span aria-hidden>·</span>
                <button type="button" onClick={beginEdit} className="hover:text-foreground">
                  Edit
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              className="hover:text-destructive"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="text-muted-foreground flex items-center gap-1 py-1" aria-label="Thinking">
      <span className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
      <span className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
      <span className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full" />
    </div>
  );
}

function StreamingCaret() {
  return (
    <span
      aria-hidden
      className="bg-foreground/70 ml-0.5 inline-block h-3 w-[2px] translate-y-0.5 animate-pulse"
    />
  );
}
