import { useMemo, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";

import { useChatMessages, useSwipeMessage, useDeleteMessage, useEditMessage, useImpersonateMessage } from "@/hooks/useChats";
import { useChatConfig } from "@/hooks/useChatConfig";
import { useCharacter } from "@/hooks/useCharacters";
import { useBackground } from "@/hooks/useBackgrounds";
import { usePersona } from "@/hooks/usePersonas";
import { computeActivePathFromMessages } from "@/features/chat/tree/active-path";
import { useChatGeneration } from "../hooks/use-chat-generation";
import { useChatUiStore, selectActivePlaceholderId, selectSettingsOpen, selectPortraitOpen, selectSceneOpen, selectLightboxSrc } from "../chat-store";
import { useChatMacros } from "../macros";
import { fileToDownscaledDataUrl } from "../custom-image";
import { ChatBackground } from "../components/chat-background";
import { ChatHeader } from "../components/chat-header";
import { MessageList } from "../components/message-list";
import { Composer } from "../components/composer";
import { CharacterPortraitPanel } from "../components/character-portrait-panel";
import { CustomImagePanel } from "../components/custom-image-panel";
import { ImageLightbox } from "../components/image-lightbox";
import { SettingsPanel } from "../settings/settings-panel";

export function ChatPage() {
  const { id: chatId } = useParams({ from: "/c/$id" });
  const navigate = useNavigate();

  const activePlaceholderId = useChatUiStore(selectActivePlaceholderId);
  const settingsOpen = useChatUiStore(selectSettingsOpen);
  const portraitOpen = useChatUiStore(selectPortraitOpen);
  const sceneOpen = useChatUiStore(selectSceneOpen);
  const lightboxSrc = useChatUiStore(selectLightboxSrc);

  const setInput = useChatUiStore((s) => s.setInputDraft);
  const clearInput = useChatUiStore((s) => s.clearInputDraft);
  const setSettingsOpen = useChatUiStore((s) => s.setSettingsOpen);
  const setPortraitOpen = useChatUiStore((s) => s.setPortraitOpen);
  const setSceneOpen = useChatUiStore((s) => s.setSceneOpen);
  const openLightbox = useChatUiStore((s) => s.openLightbox);
  const closeLightbox = useChatUiStore((s) => s.closeLightbox);
  const customImage = useChatUiStore((s) => s.customImages[chatId] ?? null);
  const setCustomImage = useChatUiStore((s) => s.setCustomImage);
  const clearCustomImage = useChatUiStore((s) => s.clearCustomImage);

  const { data: config, isLoading: configLoading } = useChatConfig(chatId);
  const { data: messages, isLoading: messagesLoading } = useChatMessages(chatId);
  const { data: character } = useCharacter(config?.chat.characterId ?? "");
  const { data: background } = useBackground(config?.chat.backgroundId ?? "");
  const { data: persona } = usePersona(config?.settings.defaultPersonaId ?? "");

  const substitute = useChatMacros(config);
  const generation = useChatGeneration(chatId, config?.chat.lockMessageLocalId ?? null);

  const swipeMutation = useSwipeMessage();
  const deleteMsgMutation = useDeleteMessage();
  const editMutation = useEditMessage();
  const impersonateMutation = useImpersonateMessage();

  const activePath = useMemo(
    () =>
      messages
        ? computeActivePathFromMessages(
            messages.map((m) => ({ ...m, extra: m.extra ?? undefined })),
          )
        : [],
    [messages],
  );

  const isBusy = config ? config.chat.lockState !== "idle" : false;
  const hasMessages = activePath.length > 0;
  const composerDisabled = config?.chat.lockState === "generating" && activePlaceholderId === null;

  const userAvatarSrc = persona?.iconPath ?? null;
  const characterAvatarSrc = character?.imagePath ?? null;
  const backgroundSrc = background?.path ?? null;

  const handleSend = useCallback(() => {
    if (generation.isStreaming) return;
    const trimmed = (useChatUiStore.getState().inputDrafts[chatId] ?? "").trim();

    if (trimmed) {
      const final = substitute(trimmed);
      clearInput(chatId);
      generation.start("send", { content: final });
    } else if (hasMessages) {
      generation.start("continue");
    }
  }, [chatId, substitute, clearInput, generation, hasMessages]);

  const handleSwipe = useCallback(
    (messageLocalId: number, direction: "next" | "prev") => {
      if (isBusy) return;
      swipeMutation.mutate({ chatId, messageLocalId, direction });
    },
    [chatId, isBusy, swipeMutation],
  );

  const handleRegenerate = useCallback(
    (messageLocalId: number) => {
      if (isBusy) return;
      generation.start("regenerate", { messageLocalId });
    },
    [isBusy, generation],
  );

  const handleEdit = useCallback(
    (messageLocalId: number, content: string) => {
      if (isBusy) return;
      const final = substitute(content);
      editMutation.mutate({ chatId, messageLocalId, content: final });
    },
    [chatId, isBusy, substitute, editMutation],
  );

  const handleDelete = useCallback(
    (messageLocalId: number) => {
      if (isBusy) return;
      deleteMsgMutation.mutate(
        { chatId, messageLocalId },
        { onSuccess: () => toast.success("Message deleted") },
      );
    },
    [chatId, isBusy, deleteMsgMutation],
  );

  const handleImpersonate = useCallback(() => {
    if (isBusy) return;
    impersonateMutation.mutate(
      { chatId },
      {
        onSuccess: (result) => {
          setInput(chatId, result.text);
        },
        onError: () => {
          toast.error("Impersonation failed");
        },
      },
    );
  }, [chatId, isBusy, impersonateMutation, setInput]);

  const handleUploadImage = useCallback(
    async (file: File) => {
      try {
        const dataUrl = await fileToDownscaledDataUrl(file);
        setCustomImage(chatId, dataUrl);
      } catch {
        toast.error("Failed to load image");
      }
    },
    [chatId, setCustomImage],
  );

  const handleClearImage = useCallback(() => {
    clearCustomImage(chatId);
  }, [chatId, clearCustomImage]);

  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    };

    const lastAssistant = [...activePath].reverse().find((e) => e.message.role === "assistant");

    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const typing = isTypingTarget(e.target);

      if (!mod || !e.shiftKey) return;
      if (isBusy) return;

      if (e.key.toLowerCase() === "r" && !typing) {
        if (!lastAssistant) return;
        e.preventDefault();
        generation.start("regenerate", { messageLocalId: lastAssistant.message.localId });
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (typing) return;
        if (!lastAssistant) return;
        e.preventDefault();
        handleSwipe(lastAssistant.message.localId, e.key === "ArrowLeft" ? "prev" : "next");
        return;
      }

      if (e.key.toLowerCase() === "i") {
        e.preventDefault();
        handleImpersonate();
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activePath, isBusy, generation, handleSwipe, handleImpersonate]);

  if (configLoading || messagesLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="flex items-center gap-2 text-[--sea-ink-soft]">
          <span className="size-2 rounded-full bg-[--lagoon] animate-bounce" />
          <span className="size-2 rounded-full bg-[--lagoon] animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="size-2 rounded-full bg-[--lagoon] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <p className="text-red-400">Chat not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <ChatBackground src={backgroundSrc} fallbackSrc={characterAvatarSrc} />

      <ChatHeader
        characterName={config.character.name}
        avatarSrc={characterAvatarSrc}
        isGenerating={generation.isStreaming}
        onBack={() => navigate({ to: "/c" })}
        portraitOpen={portraitOpen}
        sceneOpen={sceneOpen}
        onTogglePortrait={() => setPortraitOpen(!portraitOpen)}
        onToggleScene={() => setSceneOpen(!sceneOpen)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <MessageList
        entries={activePath}
        activePlaceholderId={activePlaceholderId}
        streamingText={generation.streamingText}
        characterName={config.character.name}
        userName={config.persona.name}
        characterAvatarSrc={characterAvatarSrc}
        userAvatarSrc={userAvatarSrc}
        disabled={isBusy}
        onSwipe={handleSwipe}
        onRegenerate={handleRegenerate}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <CharacterPortraitPanel
        open={portraitOpen}
        name={config.character.name}
        imageSrc={characterAvatarSrc}
        isStreaming={generation.isStreaming}
        onClose={() => setPortraitOpen(false)}
        onImageClick={() => characterAvatarSrc && openLightbox(`/${characterAvatarSrc}`)}
      />

      <CustomImagePanel
        open={sceneOpen}
        imageSrc={backgroundSrc}
        customImageSrc={customImage}
        onClose={() => setSceneOpen(false)}
        onImageClick={() => {
          if (customImage) openLightbox(customImage);
          else if (backgroundSrc) openLightbox(`/${backgroundSrc}`);
        }}
        onUploadImage={handleUploadImage}
        onClearImage={handleClearImage}
      />

      <ImageLightbox
        src={lightboxSrc}
        open={lightboxSrc !== null}
        onOpenChange={(open) => { if (!open) closeLightbox(); }}
      />

      <Composer
        chatId={chatId}
        hasMessages={hasMessages}
        onSend={handleSend}
        onStop={generation.stop}
        onImpersonate={handleImpersonate}
        isStreaming={generation.isStreaming}
        impersonatePending={impersonateMutation.isPending}
        disabled={composerDisabled}
        characterName={config.character.name}
      />

      <SettingsPanel
        chatId={chatId}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </div>
  );
}
