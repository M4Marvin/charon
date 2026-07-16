import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import { Message, MessageHeader, MessageContent, MessageFooter } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { toast } from "sonner";
import { useChat as useAiChat, fetchServerSentEvents } from "@tanstack/ai-react";
import {
  ArrowLeft,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Image,
  Settings,
  Sparkles,
  Square,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { authClient } from "@/lib/auth-client";
import { useChatStore } from "@/stores/chat-store";
import { ImageLightbox } from "@/components/chat/ImageLightbox";
import { CharacterPortraitPanel } from "@/components/chat/CharacterPortraitPanel";
import { CustomImagePanel } from "@/components/chat/CustomImagePanel";
import type { ChatMessage } from "@/lib/st-core/shared/types";
import { RichText } from "@/components/RichText";
import { balanceMarkdown } from "@/lib/markdown";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getActivePath, getSiblings } from "@/lib/st-core/chat-tree/tree";
import { rowToMessage } from "@/lib/chat/rows";

export const Route = createFileRoute("/chats/$id")({
  component: ChatPage,
});

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
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";

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

  const customImage = useChatStore((s) => s.chatImages[id]);
  const setChatImage = useChatStore((s) => s.setChatImage);
  const clearChatImage = useChatStore((s) => s.clearChatImage);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [deleteMessageTarget, setDeleteMessageTarget] = useState<number | null>(null);
  const [deleteChatOpen, setDeleteChatOpen] = useState(false);
  const [portraitOpen, setPortraitOpen] = useState(false);
  const [customImageOpen, setCustomImageOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");
  const [settingsTab, setSettingsTab] = useState(isAdmin ? "ai" : "lorebooks");

  const selectedModel = userSettings?.defaultSelectedModel ?? "";
  const hasAi = (userSettings?.defaultProviderId?.length ?? 0) > 0;
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

      const statusMatch = err.message.match(/status: (\d+)/);
      const status = statusMatch ? Number(statusMatch[1]) : 0;

      if (status === 429) {
        const now = new Date();
        const tomorrow = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
        );
        const ms = tomorrow.getTime() - now.getTime();
        const hours = Math.floor(ms / 3_600_000);
        const minutes = Math.floor((ms % 3_600_000) / 60_000);
        const seconds = Math.floor((ms % 60_000) / 1000);
        let remaining: string;
        if (hours > 0) {
          remaining = `${hours}h ${String(minutes).padStart(2, "0")}m`;
        } else if (minutes > 0) {
          remaining = `${minutes}m ${String(seconds).padStart(2, "0")}s`;
        } else {
          remaining = `${seconds}s`;
        }
        toast.error(`Daily request limit reached (100/day). Resets in ${remaining}.`);
      } else {
        const causeStr = (() => {
          const c = (err as { cause?: unknown }).cause;
          if (!c) return "";
          if (c instanceof Error) return ` — ${c.message}`;
          return ` — ${JSON.stringify(c)}`;
        })();
        toast.error(`Stream error: ${err.message}${causeStr}`);
      }

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
        const siblings = getSiblings(tree, msg.localId);
        const idx = siblings.findIndex((s) => s.localId === msg.localId);
        const isStreamingLocal = msg.localId === activePlaceholderId;
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

  // Auto-grow composer textarea (cap at TEXTAREA_MAX_HEIGHT px).
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
  }, [input]);

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
            // Reset the streaming buffer so liveAssistantText only
            // sees the current run's assistant message — not stale
            // text from the previous generation.
            aiChat.setMessages([]);
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
          void aiChat.setMessages([]);
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

  const handleStop = useCallback(() => {
    const placeholderId = useChatStore.getState().activePlaceholderId;
    if (!placeholderId) return;
    cancelStream.mutate(
      { chatId: id, messageLocalId: placeholderId },
      { onSuccess: () => clearPlaceholder() },
    );
  }, [id, cancelStream, clearPlaceholder]);

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
      const entry = activePath.find((p) => p.message.localId === messageLocalId);
      if (entry) {
        console.log("[swipe] entry resolved", {
          parentId: entry.message.parentLocalId,
          siblingIndex: entry.siblingIndex,
          siblingTotal: entry.siblingTotal,
          isStreaming: entry.isStreaming,
        });
      }
      if (entry && entry.message.role !== "user" && messageLocalId !== 0) {
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
        const isGreeting = entry.message.parentLocalId === 0;
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
              // Reset the streaming buffer — the server builds context
              // from the DB, so aiChat.messages is just transport state.
              void aiChat.setMessages([]);
              void aiChat.sendMessage(".");
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
      setDeleteMessageTarget(messageLocalId);
    },
    [activePlaceholderId],
  );

  const handleConfirmDeleteMessage = useCallback(() => {
    if (deleteMessageTarget === null) return;
    deleteMessageMutation.mutate({ chatId: id, messageLocalId: deleteMessageTarget });
    setDeleteMessageTarget(null);
  }, [id, deleteMessageMutation, deleteMessageTarget]);

  const handleEditMessage = useCallback(
    (messageLocalId: number, content: string) => {
      if (activePlaceholderId !== null) return;
      editMessageMutation.mutate({ chatId: id, messageLocalId, content });
    },
    [id, editMessageMutation, activePlaceholderId],
  );

  const handleDeleteChat = useCallback(() => {
    setDeleteChatOpen(true);
  }, []);

  const handleConfirmDeleteChat = useCallback(() => {
    deleteChatMutation.mutate({ id }, { onSuccess: () => void navigate({ to: "/chats" }) });
    setDeleteChatOpen(false);
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
  const backgroundUrl = chat.backgroundId
    ? `/api/backgrounds/${chat.backgroundId}/image`
    : null;
  const ambientUrl =
    backgroundUrl ??
    (chat.characterImagePath ? `/api/characters/${chat.characterId}/avatar` : null);

  const avatarNode = (
    <Avatar className="size-8 shrink-0 ring-1 ring-(--lagoon)/20">
      {chat.characterImagePath ? (
        <AvatarImage src={`/api/characters/${chat.characterId}/avatar`} alt={chat.characterName} />
      ) : null}
      <AvatarFallback className="text-[10px]">{chat.characterName[0]}</AvatarFallback>
    </Avatar>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative flex h-dvh flex-col overflow-hidden">
        {/* ── Background layer ── */}
        {ambientUrl && (
          <div className="fixed inset-0 z-0">
            <img
              src={ambientUrl}
              className="size-full object-cover blur-sm brightness-[0.4]"
              alt=""
            />
            <div className="vn-vignette absolute inset-0" />
          </div>
        )}

        {/* ── Fixed chat header ── */}
        <header className="glass sticky top-0 z-30 flex h-12 shrink-0 items-center border-b border-white/5">
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center px-3">
            <div className="flex items-center justify-start">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Back to chats"
                  >
                    <Link to="/chats">
                      <ArrowLeft className="size-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Back to chats</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full p-0 hidden md:inline-flex"
                    onClick={() => setPortraitOpen(!portraitOpen)}
                    aria-label={
                      portraitOpen ? "Hide character portrait" : "Show character portrait"
                    }
                  >
                    {avatarNode}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{portraitOpen ? "Hide portrait" : "Show portrait"}</TooltipContent>
              </Tooltip>
              <div className="md:hidden">{avatarNode}</div>
              <p className="truncate text-sm font-heading leading-tight">{chat.characterName}</p>
              {selectedModel && isAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsTab("ai");
                        setSettingsOpen(true);
                      }}
                      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                      aria-label={`Model: ${selectedModel}. Open AI settings.`}
                    >
                      <Badge
                        variant="outline"
                        className="max-w-[8rem] truncate font-mono text-[10px] text-muted-foreground"
                      >
                        {selectedModel}
                      </Badge>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Open AI settings</TooltipContent>
                </Tooltip>
              )}
              {isStreaming && (
                <Badge
                  variant="secondary"
                  className="shimmer gap-1 text-[10px] text-muted-foreground"
                >
                  <Spinner className="size-2.5" />
                  Generating
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-end gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 hidden md:inline-flex"
                    onClick={() => setCustomImageOpen(!customImageOpen)}
                    aria-label={customImageOpen ? "Hide custom image" : "Show custom image"}
                  >
                    <Image className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {customImageOpen ? "Hide custom image" : "Show custom image"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    aria-label="Toggle settings panel"
                  >
                    <Settings className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Chat settings</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        {/* ── Three-column body: portrait | messages | custom image ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="grid flex-1 overflow-hidden grid-cols-1 md:grid-cols-[15fr_70fr_15fr]">
            {/* Left: Character portrait column — always in grid, content conditional */}
            <div className="hidden md:flex flex-col overflow-y-auto z-10">
              {portraitOpen && (
                <CharacterPortraitPanel
                  characterId={chat.characterId}
                  characterName={chat.characterName}
                  imagePath={chat.characterImagePath}
                  isStreaming={activePlaceholderId !== null}
                  onClick={() => {
                    setLightboxAlt(chat.characterName);
                    setLightboxSrc(
                      chat.characterImagePath ? `/api/characters/${chat.characterId}/avatar` : null,
                    );
                  }}
                  onUpload={(base64) => setChatImage(chat.id, base64)}
                />
              )}
            </div>

            {/* Center: Messages only */}
            <div className="flex flex-col overflow-hidden">
              <MessageScrollerProvider
                autoScroll={true}
                defaultScrollPosition="last-anchor"
                scrollEdgeThreshold={80}
                scrollPreviousItemPeek={64}
              >
                <MessageScroller className="flex-1">
                  <MessageScrollerViewport>
                    <MessageScrollerContent
                      className="mx-auto w-full px-4 py-2 gap-1"
                      aria-busy={activePlaceholderId !== null}
                    >
                      {/* Character intro card */}
                      {(characterDescription || characterTags.length > 0) && (
                        <MessageScrollerItem>
                          <CharacterIntroCard
                            name={chat.characterName}
                            imagePath={chat.characterImagePath}
                            characterId={chat.characterId}
                            description={characterDescription}
                            tags={characterTags}
                          />
                        </MessageScrollerItem>
                      )}

                      {activePath.length === 0 ? (
                        <MessageScrollerItem>
                          <Marker variant="default" className="justify-center">
                            <MarkerContent>No messages yet. Say hello!</MarkerContent>
                          </Marker>
                        </MessageScrollerItem>
                      ) : (
                        activePath.map((entry, index) => (
                          <MessageScrollerItem
                            key={entry.message.localId}
                            messageId={entry.message.localId.toString()}
                            scrollAnchor={entry.message.role === "user"}
                          >
                            <ChatMessage
                              entry={entry}
                              isNewest={index === activePath.length - 1}
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
                          </MessageScrollerItem>
                        ))
                      )}
                    </MessageScrollerContent>
                  </MessageScrollerViewport>
                  <MessageScrollerButton direction="end" />
                </MessageScroller>
              </MessageScrollerProvider>
            </div>

            {/* Right: Custom image column — always in grid, content conditional */}
            <div className="hidden md:flex flex-col overflow-y-auto z-10">
              {customImageOpen && (
                <CustomImagePanel
                  imageBase64={customImage ?? null}
                  onUpload={(base64) => setChatImage(chat.id, base64)}
                  onRemove={() => clearChatImage(chat.id)}
                  onClick={() => {
                    const img = useChatStore.getState().chatImages[chat.id];
                    if (img) {
                      setLightboxAlt("Custom image");
                      setLightboxSrc(img);
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* ── Composer + AI hint ── */}
          <div className="glass-strong z-10 shrink-0 border-t border-white/5 px-4 py-2.5">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-1.5">
              {!hasAi && isAdmin && (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="text-muted-foreground hover:text-foreground self-start text-xs transition-colors"
                >
                  No AI configured — open settings →
                </button>
              )}
              <div className="glass flex items-end gap-2 rounded-2xl px-3 py-1.5">
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
                  className="min-h-8 flex-1 resize-none border-0 bg-transparent px-1 py-0.5 text-sm shadow-none focus-visible:ring-0"
                  rows={1}
                  disabled={!canSend}
                />
                {isStreaming ? (
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={handleStop}
                    className="size-8 shrink-0 rounded-full"
                    aria-label="Stop generating"
                  >
                    <Square className="size-3.5 fill-current" />
                  </Button>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <ChatSettingsPanel
          chat={chat}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onDeleteChat={handleDeleteChat}
          isStreaming={activePlaceholderId !== null}
          activeTab={settingsTab}
          onActiveTabChange={setSettingsTab}
        />

        <ImageLightbox
          open={lightboxSrc !== null}
          src={lightboxSrc}
          alt={lightboxAlt}
          onOpenChange={(open) => {
            if (!open) {
              setLightboxSrc(null);
              setLightboxAlt("");
            }
          }}
        />

        <AlertDialog
          open={deleteMessageTarget !== null}
          onOpenChange={(open) => !open && setDeleteMessageTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete message?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete this message and all replies below it. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleConfirmDeleteMessage}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteChatOpen} onOpenChange={setDeleteChatOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete chat?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this entire conversation. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleConfirmDeleteChat}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
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
    <div className="glass flex items-start gap-4 rounded-2xl p-4">
      <Avatar className="size-14 shrink-0">
        {imagePath ? (
          <AvatarImage src={`/api/characters/${characterId}/avatar`} alt={name} />
        ) : null}
        <AvatarFallback>{name[0]}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-base font-heading">{name}</p>
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
                className="rounded-full border border-white/10 bg-(--lagoon)/10 px-2 py-0.5 text-[10px] text-(--lagoon-deep)"
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

function ChatMessage({
  entry,
  isNewest = false,
  characterName,
  characterImagePath: _characterImagePath,
  characterId: _characterId,
  personaName,
  personaIconPath: _personaIconPath,
  onSwipe,
  onDelete,
  onEdit,
  disabled,
}: {
  entry: PathEntry;
  isNewest?: boolean;
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
  const isUser = message.role === "user";
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
    onEdit(message.localId, trimmed);
    setIsEditing(false);
  };

  const displayName = isUser ? (personaName ?? "You") : characterName;
  const showFooter = !isEditing && !isDraft && !disabled;
  const showNameplateActions = !isEditing && !isDraft && !disabled;

  return (
    <div className={isNewest ? "animate-msg-in" : ""}>
      <Message data-is-user={isUser ? "true" : "false"}>
        <MessageHeader>
          <span className="inline-flex items-center gap-1.5">
            {isStreaming && (
              <span aria-hidden className="text-[10px] text-(--lagoon)">
                ✦
              </span>
            )}
            {displayName}
          </span>
          {showNameplateActions && (
            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <button type="button" onClick={beginEdit} className="hover:text-foreground">
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(message.localId)}
                className="hover:text-destructive"
              >
                Delete
              </button>
            </span>
          )}
        </MessageHeader>
        <MessageContent>
          <Bubble variant={isUser ? "default" : "ghost"}>
            <BubbleContent className={isDraft || isStreaming ? "opacity-90" : ""}>
              {isDraft ? (
                <p className="text-muted-foreground text-sm italic">Type your message...</p>
              ) : isEditing ? (
                <div className="w-full space-y-2">
                  <Textarea
                    ref={editRef}
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    className="min-h-10 resize-none border-0 bg-transparent p-0 text-sm outline-none focus-visible:ring-0 prose prose-sm prose-invert max-w-none prose-headings:font-heading prose-code:font-mono prose-pre:font-mono"
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
                <p className="shimmer text-muted-foreground text-sm">Thinking…</p>
              ) : (
                <div className="prose prose-sm prose-invert max-w-none prose-headings:font-heading prose-code:font-mono prose-pre:font-mono">
                  <RichText
                    content={
                      isStreaming ? balanceMarkdown(message.content, false) : message.content
                    }
                  />
                  {isStreaming && <StreamingCaret />}
                </div>
              )}
            </BubbleContent>
          </Bubble>
        </MessageContent>
        {showFooter && (
          <MessageFooter>
            <span className="ml-auto inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSwipe(message.localId, "prev")}
                disabled={siblingIndex === 0}
                className="hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 rounded-full p-0.5"
                aria-label="Previous message"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-muted-foreground tabular-nums text-[11px]">
                {siblingIndex + 1}/{siblingTotal}
              </span>
              <button
                type="button"
                onClick={() => onSwipe(message.localId, "next")}
                className="hover:text-foreground rounded-full p-0.5"
                aria-label="Next message"
              >
                <ChevronRight className="size-4" />
              </button>
            </span>
          </MessageFooter>
        )}
      </Message>
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
