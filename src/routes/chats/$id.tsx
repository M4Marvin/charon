import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useChat as useAiChat, fetchServerSentEvents } from "@tanstack/ai-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useChat,
  useChatMessages,
  useDeleteChat,
  useDeleteMessage,
  useEditMessage,
  usePrepareStream,
  useFinalizeStream,
  useCancelStream,
  useUpdateChatSettings,
  useSwipeMessage,
} from "@/hooks/useChats";
import { useAiProviders } from "@/hooks/useAiProviders";
import { usePresets } from "@/hooks/usePresets";
import { useProviderModels } from "@/hooks/useProviderModels";
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

  const { data: providers = [] } = useAiProviders();
  const { data: presets = [] } = usePresets();

  const prepareStream = usePrepareStream();
  const finalizeStream = useFinalizeStream();
  const cancelStream = useCancelStream();
  const deleteMessageMutation = useDeleteMessage();
  const editMessageMutation = useEditMessage();
  const deleteChatMutation = useDeleteChat();
  const swipeMutation = useSwipeMessage();
  const updateSettings = useUpdateChatSettings();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [activePlaceholderId, setActivePlaceholderId] = useState<number | null>(null);
  const activePlaceholderRef = useRef<number | null>(null);
  useEffect(() => {
    activePlaceholderRef.current = activePlaceholderId;
  }, [activePlaceholderId]);

  const selectedProviderId = chat?.providerId ?? "";
  const selectedPresetId = chat?.presetId ?? "";
  const selectedModel = chat?.selectedModel ?? "";

  const { data: models = [] } = useProviderModels(selectedProviderId);

  const handleChangeProvider = useCallback(
    (providerId: string) => {
      if (!chat) return;
      updateSettings.mutate({ id: chat.id, providerId, selectedModel: null, presetId: null });
    },
    [chat, updateSettings],
  );

  const handleChangePreset = useCallback(
    (presetId: string) => {
      if (!chat) return;
      updateSettings.mutate({ id: chat.id, presetId: presetId || null });
    },
    [chat, updateSettings],
  );

  const handleChangeModel = useCallback(
    (model: string) => {
      if (!chat) return;
      updateSettings.mutate({ id: chat.id, selectedModel: model });
    },
    [chat, updateSettings],
  );

  const canSend = selectedProviderId.length > 0 && selectedModel.length > 0 && activePlaceholderId === null;

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
        return {
          message: msg,
          siblingIndex: idx,
          siblingTotal: siblings.length,
          isDraft: (msg.extra?.isDraft ?? false) === true,
          isStreaming: msg.id === activePlaceholderId,
        };
      });
  }, [messages, activePlaceholderId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Streaming connection — ref-based body so it picks up the latest placeholder ID
  const bodyRef = useRef<{ chatId: string; assistantMessageLocalId: number }>({
    chatId: id,
    assistantMessageLocalId: 0,
  });
  useEffect(() => {
    bodyRef.current.assistantMessageLocalId = activePlaceholderId ?? 0;
  }, [activePlaceholderId]);

  const connection = useMemo(
    () =>
      fetchServerSentEvents("/api/chat-generate", () => ({
        body: { chatId: id, assistantMessageLocalId: bodyRef.current.assistantMessageLocalId },
      })),
    [id],
  );

  const aiChat = useAiChat({
    connection,
    onFinish: () => {
      const placeholderId = activePlaceholderRef.current;
      if (!placeholderId) return;
      const msgs = aiChat.messages;
      const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
      const content = lastAssistant
        ? lastAssistant.parts.map((p) => (p.type === "text" ? p.content : "")).join("")
        : "";
      if (content) {
        finalizeStream.mutate(
          { chatId: id, messageLocalId: placeholderId, content },
          {
            onSuccess: () => setActivePlaceholderId(null),
            onError: (e) => toast.error(`Save failed: ${(e as Error).message}`),
          },
        );
      } else {
        setActivePlaceholderId(null);
      }
    },
    onError: (err) => {
      toast.error(`Stream error: ${err.message}`);
      const placeholderId = activePlaceholderRef.current;
      if (placeholderId) {
        cancelStream.mutate(
          { chatId: id, messageLocalId: placeholderId },
          { onSuccess: () => setActivePlaceholderId(null) },
        );
      }
    },
  });

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !canSend) return;
    setInput("");
    prepareStream.mutate(
      { chatId: id, mode: "send", content: trimmed },
      {
        onSuccess: (result) => {
          setActivePlaceholderId(result.assistantMessageLocalId);
          // Trigger the stream via useChat's sendMessage
          void aiChat.sendMessage(trimmed);
        },
        onError: (e) => toast.error(`Send error: ${(e as Error).message}`),
      },
    );
  }, [input, canSend, id, prepareStream, aiChat]);

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
      if (activePlaceholderId) return;
      if (direction === "prev") {
        swipeMutation.mutate({ chatId: id, messageLocalId, direction });
        return;
      }
      // Next on assistant → regenerate via streaming
      const entry = activePath.find((p) => p.message.id === messageLocalId);
      if (entry && !entry.message.is_user && messageLocalId !== 0) {
        prepareStream.mutate(
          { chatId: id, mode: "regenerate", messageLocalId },
          {
            onSuccess: (result) => {
              setActivePlaceholderId(result.assistantMessageLocalId);
              // Trigger the stream with an empty message (the endpoint reads from DB)
              void aiChat.sendMessage("");
            },
            onError: (e) => toast.error(`Regenerate error: ${(e as Error).message}`),
          },
        );
        return;
      }
      // Next on user → default swipe (draft)
      swipeMutation.mutate({ chatId: id, messageLocalId, direction });
    },
    [id, swipeMutation, prepareStream, activePlaceholderId, activePath, aiChat],
  );

  const handleDeleteMessage = useCallback(
    (messageLocalId: number) => {
      if (activePlaceholderId) return;
      if (!window.confirm("Delete this message and all replies below it?")) return;
      deleteMessageMutation.mutate({ chatId: id, messageLocalId });
    },
    [id, deleteMessageMutation, activePlaceholderId],
  );

  const handleEditMessage = useCallback(
    (messageLocalId: number, content: string) => {
      if (activePlaceholderId) return;
      editMessageMutation.mutate({ chatId: id, messageLocalId, content });
    },
    [id, editMessageMutation, activePlaceholderId],
  );

  const handleDeleteChat = useCallback(() => {
    if (!window.confirm("Delete this chat?")) return;
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
      {/* Settings sidebar */}
      {sidebarOpen && (
        <aside className="w-72 shrink-0 overflow-y-auto border-r p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Chat Settings</h2>
            <Button size="sm" variant="ghost" onClick={() => setSidebarOpen(false)}>
              ✕
            </Button>
          </div>

          <section className="space-y-2">
            <Label className="text-xs">Provider</Label>
            <Select value={selectedProviderId} onValueChange={handleChangeProvider}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
                {providers.length === 0 && (
                  <div className="text-muted-foreground px-3 py-2 text-xs">
                    No providers configured
                  </div>
                )}
              </SelectContent>
            </Select>
          </section>

          <Separator className="my-3" />

          <section className="space-y-2">
            <Label className="text-xs">Model</Label>
            <Select
              value={selectedModel}
              onValueChange={handleChangeModel}
              disabled={!selectedProviderId}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    selectedProviderId ? "Loading models..." : "Select a provider first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id}
                  </SelectItem>
                ))}
                {models.length === 0 && selectedProviderId && (
                  <div className="text-muted-foreground px-3 py-2 text-xs">
                    No models fetched
                  </div>
                )}
              </SelectContent>
            </Select>
            <Input
              value={selectedModel}
              onChange={(e) => handleChangeModel(e.target.value)}
              placeholder="Or type model ID"
              className="mt-1"
            />
          </section>

          <Separator className="my-3" />

          <section className="space-y-2">
            <Label className="text-xs">Preset</Label>
            <Select
              value={selectedPresetId || "_none"}
              onValueChange={(v) => handleChangePreset(v === "_none" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— None —</SelectItem>
                {presets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <Separator className="my-3" />

          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/ai-playground">Configure providers</Link>
          </Button>
        </aside>
      )}

      {/* Main chat area */}
      <div className="mx-auto flex max-w-4xl flex-1 flex-col px-4">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b py-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/chats">←</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen((o) => !o)}>
            {sidebarOpen ? "✕ Settings" : "☰ Settings"}
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
            <button type="button" className="underline" onClick={() => setSidebarOpen(true)}>
              settings sidebar
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
              canSend
                ? "Type a message... (Enter to send, Shift+Enter for newline)"
                : activePlaceholderId
                  ? "Waiting for response..."
                  : "Configure a provider and model in the sidebar to start"
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
