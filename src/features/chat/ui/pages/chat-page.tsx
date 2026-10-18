import { useMemo, useCallback } from "react";
import { withImageVersion } from "@/lib/image-optimization";
import { useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  useChatMessages,
  useSwipeMessage,
  useDeleteMessage,
  useEditMessage,
  useImpersonateMessage,
  useImagePrompt,
} from "@/hooks/useChats";
import { useChatConfig } from "@/hooks/useChatConfig";
import { computeActivePathFromMessages } from "@/features/chat/tree/active-path";
import { useChatGeneration } from "../hooks/use-chat-generation";
import {
  useChatUiStore,
  selectActivePlaceholderId,
  selectPendingSend,
  selectSettingsOpen,
  selectPortraitOpen,
  selectSceneOpen,
  selectLightboxSrc,
} from "../chat-store";
import { isPendingVisible } from "../pending";
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
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonRows } from "@/components/common/Skeletons";
import { MessageSquareX } from "lucide-react";

export function ChatPage() {
  const { id: chatId } = useParams({ from: "/chat/$id" });
  const navigate = useNavigate();

  const activePlaceholderId = useChatUiStore(selectActivePlaceholderId);
  const pendingSend = useChatUiStore(selectPendingSend);
  const settingsOpen = useChatUiStore(selectSettingsOpen);
  const portraitOpen = useChatUiStore(selectPortraitOpen);
  const sceneOpen = useChatUiStore(selectSceneOpen);
  const lightboxSrc = useChatUiStore(selectLightboxSrc);

  const setInput = useChatUiStore((s) => s.setInputDraft);
  const clearInput = useChatUiStore((s) => s.clearInputDraft);
  const focusComposer = useChatUiStore((s) => s.focusComposer);
  const setSettingsOpen = useChatUiStore((s) => s.setSettingsOpen);
  const setPortraitOpen = useChatUiStore((s) => s.setPortraitOpen);
  const setSceneOpen = useChatUiStore((s) => s.setSceneOpen);
  const openLightbox = useChatUiStore((s) => s.openLightbox);
  const closeLightbox = useChatUiStore((s) => s.closeLightbox);
  const customImage = useChatUiStore((s) => s.customImages[chatId] ?? null);
  const setCustomImage = useChatUiStore((s) => s.setCustomImage);
  const clearCustomImage = useChatUiStore((s) => s.clearCustomImage);

  const {
    data: config,
    isLoading: configLoading,
    isError: configError,
    error: configErrorObj,
    refetch: refetchConfig,
  } = useChatConfig(chatId);
  const {
    data: messages,
    isLoading: messagesLoading,
    isError: messagesError,
    error: messagesErrorObj,
    refetch: refetchMessages,
  } = useChatMessages(chatId);

  const substitute = useChatMacros(config);
  const generation = useChatGeneration(chatId, config?.chat.lockMessageLocalId ?? null);

  const swipeMutation = useSwipeMessage();
  const deleteMsgMutation = useDeleteMessage();
  const editMutation = useEditMessage();
  const impersonateMutation = useImpersonateMessage();
  const imagePromptMutation = useImagePrompt();

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
  // The placeholder id lives in a global store. Only the chat that owns the
  // live run may read it, otherwise a navigation would render another chat's
  // streamed text.
  const ownsGeneration = generation.ownerChatId === chatId;
  const localStreaming = ownsGeneration && generation.isStreaming;
  const scopedPlaceholderId = ownsGeneration ? activePlaceholderId : null;
  const scopedStreamingText = ownsGeneration ? generation.streamingText : "";
  const pendingVisible = pendingSend
    ? isPendingVisible(pendingSend, chatId, activePath, scopedPlaceholderId)
    : false;
  const composerDisabled = config?.chat.lockState === "generating" && scopedPlaceholderId === null;

  const characterAvatarUrl = config?.characterImagePath
    ? withImageVersion(
        `/api/characters/${config.chat.characterId}/avatar`,
        config.characterImagePath,
      )
    : null;
  const userAvatarUrl =
    config?.personaId && config.personaIconPath
      ? withImageVersion(`/api/personas/${config.personaId}/icon`, config.personaIconPath)
      : null;
  const backgroundUrl =
    config?.chat.backgroundId && config.backgroundPath
      ? withImageVersion(
          `/api/backgrounds/${config.chat.backgroundId}/image`,
          config.backgroundPath,
        )
      : null;

  const ensureModelConfigured = useCallback(() => {
    // A provider row exists but has no resolvable model (neither a selected
    // default nor a provider default). Block here so the user gets an
    // actionable message instead of a silent stream failure.
    if (config?.settings.defaultProviderId && !config.provider) {
      toast.error("No model configured — choose a model in chat settings");
      return false;
    }
    return true;
  }, [config]);

  const refuseBusy = useCallback(() => {
    if (generation.isStreaming && generation.ownerChatId !== chatId) {
      toast.error("A reply is still generating in another chat");
    } else {
      toast.error("Wait for the current reply to finish");
    }
  }, [chatId, generation.isStreaming, generation.ownerChatId]);

  // Wand and impersonation output must never overwrite text the user typed.
  const applyGeneratedText = useCallback(
    (text: string) => {
      const draft = useChatUiStore.getState().inputDrafts[chatId] ?? "";
      if (draft.trim()) {
        setInput(chatId, `${draft}\n${text}`);
        toast.success("Inserted below your draft");
      } else {
        setInput(chatId, text);
      }
    },
    [chatId, setInput],
  );

  // Callbacks below depend on `.mutate`/`.start` alone, not on the mutation or
  // generation objects: both are recreated every render and would defeat the
  // memo on ChatMessage during streaming.
  const handleSend = useCallback(() => {
    if (isBusy) {
      refuseBusy();
      return;
    }
    if (generation.isStreaming) {
      refuseBusy();
      return;
    }
    if (!ensureModelConfigured()) return;
    const trimmed = (useChatUiStore.getState().inputDrafts[chatId] ?? "").trim();

    if (trimmed) {
      const final = substitute(trimmed);
      clearInput(chatId);
      generation.start("send", { content: final });
    } else if (hasMessages) {
      generation.start("continue");
    }
  }, [
    chatId,
    substitute,
    clearInput,
    isBusy,
    refuseBusy,
    generation.isStreaming,
    generation.start,
    hasMessages,
    ensureModelConfigured,
  ]);

  const handleSwipe = useCallback(
    (messageLocalId: number, direction: "next" | "prev") => {
      if (isBusy || generation.isStreaming) {
        refuseBusy();
        return;
      }
      swipeMutation.mutate(
        { chatId, messageLocalId, direction },
        { onError: () => toast.error("Swipe failed") },
      );
    },
    [chatId, isBusy, refuseBusy, generation.isStreaming, swipeMutation.mutate],
  );

  const handleRegenerate = useCallback(
    (messageLocalId: number) => {
      if (isBusy || generation.isStreaming) {
        refuseBusy();
        return;
      }
      if (!ensureModelConfigured()) return;
      generation.start("regenerate", { messageLocalId });
    },
    [isBusy, refuseBusy, generation.isStreaming, generation.start, ensureModelConfigured],
  );

  const handleEdit = useCallback(
    (messageLocalId: number, content: string) => {
      if (isBusy || generation.isStreaming) {
        refuseBusy();
        return false;
      }
      const final = substitute(content);
      editMutation.mutate(
        { chatId, messageLocalId, content: final },
        { onError: () => toast.error("Edit failed — message restored") },
      );
      return true;
    },
    [chatId, isBusy, refuseBusy, generation.isStreaming, substitute, editMutation.mutate],
  );

  const handleDelete = useCallback(
    (messageLocalId: number) => {
      if (isBusy || generation.isStreaming) {
        refuseBusy();
        return false;
      }
      deleteMsgMutation.mutate(
        { chatId, messageLocalId },
        {
          onSuccess: () => {
            toast.success("Message deleted");
            focusComposer();
          },
          onError: () => toast.error("Delete failed"),
        },
      );
      return true;
    },
    [chatId, isBusy, refuseBusy, generation.isStreaming, deleteMsgMutation.mutate, focusComposer],
  );

  const handleImpersonate = useCallback(() => {
    if (isBusy || generation.isStreaming) {
      refuseBusy();
      return;
    }
    if (!activePath.some((entry) => entry.message.role === "user")) {
      toast.error("Add a message before impersonating");
      return;
    }
    impersonateMutation.mutate(
      { chatId },
      {
        onSuccess: (result) => {
          applyGeneratedText(result.text);
        },
        onError: (error) => {
          toast.error(error.message || "Impersonation failed");
        },
      },
    );
  }, [
    chatId,
    isBusy,
    refuseBusy,
    generation.isStreaming,
    activePath,
    impersonateMutation.mutate,
    applyGeneratedText,
  ]);

  const handleImagePrompt = useCallback(() => {
    if (isBusy || generation.isStreaming) {
      refuseBusy();
      return;
    }
    imagePromptMutation.mutate(
      { chatId },
      {
        onSuccess: (result) => {
          if (!result.text.trim()) {
            toast.error("Failed to generate image prompt");
            return;
          }
          applyGeneratedText(result.text);
          focusComposer();
        },
        onError: () => {
          toast.error("Failed to generate image prompt");
        },
      },
    );
  }, [
    chatId,
    isBusy,
    refuseBusy,
    generation.isStreaming,
    imagePromptMutation.mutate,
    applyGeneratedText,
    focusComposer,
  ]);

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

  if (configLoading || messagesLoading) {
    return (
      <main
        role="status"
        aria-busy="true"
        className="flex h-dvh w-full flex-col overflow-hidden bg-base [&_[data-slot=skeleton]]:motion-reduce:animate-none"
      >
        <span className="sr-only">Loading chat</span>
        <div
          aria-hidden="true"
          className="flex h-12 shrink-0 items-center gap-3 border-b border-subtle px-3 md:px-5"
        >
          <span className="size-7 rounded-full bg-raised" />
          <span className="h-4 w-32 rounded bg-raised" />
        </div>
        <div aria-hidden="true" className="mx-auto w-full max-w-3xl flex-1 px-3 pt-12 md:px-6">
          <SkeletonRows rows={5} />
        </div>
      </main>
    );
  }

  // Only a load failure with no usable data replaces the page: TanStack keeps
  // data on a failed background refetch but still flips `isError`, and every
  // generation mutation invalidates these queries.
  const configFailed = configError && config === undefined;
  const messagesFailed = messagesError && messages === undefined;
  if (configFailed || messagesFailed) {
    const errorObj = configFailed ? configErrorObj : messagesErrorObj;
    return (
      <main className="flex h-dvh w-full flex-col items-center justify-center bg-base p-6">
        <div className="w-full max-w-md">
          <ErrorBanner
            message={errorObj instanceof Error ? errorObj.message : "Failed to load chat"}
            onRetry={() => {
              void refetchConfig();
              void refetchMessages();
            }}
          />
        </div>
      </main>
    );
  }

  if (!config) {
    return (
      <main className="flex h-dvh w-full flex-col items-center justify-center bg-base p-6">
        <div role="alert" className="w-full max-w-md">
          <EmptyState
            icon={MessageSquareX}
            title="Chat not found"
            description="This chat may have been deleted, or the link is wrong."
          />
        </div>
      </main>
    );
  }

  return (
    <main className="grid h-dvh w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-base pb-[var(--keyboard-inset,0px)]">
      <ChatBackground src={backgroundUrl} fallbackSrc={characterAvatarUrl} />

      <ChatHeader
        characterName={config.character.name}
        avatarSrc={characterAvatarUrl}
        isGenerating={localStreaming}
        onBack={() => navigate({ to: "/chat" })}
        portraitOpen={portraitOpen}
        sceneOpen={sceneOpen}
        onTogglePortrait={() => setPortraitOpen(!portraitOpen)}
        onToggleScene={() => setSceneOpen(!sceneOpen)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <MessageList
        key={chatId}
        chatId={chatId}
        entries={activePath}
        activePlaceholderId={scopedPlaceholderId}
        streamingText={scopedStreamingText}
        pendingUserContent={pendingVisible ? (pendingSend?.content ?? null) : null}
        showPendingAssistant={pendingVisible}
        characterName={config.character.name}
        userName={config.persona.name}
        characterAvatarSrc={characterAvatarUrl}
        userAvatarSrc={userAvatarUrl}
        disabled={isBusy}
        onSwipe={handleSwipe}
        onRegenerate={handleRegenerate}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <CharacterPortraitPanel
        open={portraitOpen}
        name={config.character.name}
        imageSrc={characterAvatarUrl}
        isStreaming={localStreaming}
        onClose={() => {
          setPortraitOpen(false);
          focusComposer();
        }}
        onImageClick={() => characterAvatarUrl && openLightbox(characterAvatarUrl)}
      />

      <CustomImagePanel
        open={sceneOpen}
        imageSrc={backgroundUrl}
        customImageSrc={customImage}
        alt="Scene"
        onClose={() => {
          setSceneOpen(false);
          focusComposer();
        }}
        onImageClick={() => {
          if (customImage) openLightbox(customImage);
          else if (backgroundUrl) openLightbox(backgroundUrl);
        }}
        onUploadImage={handleUploadImage}
        onClearImage={handleClearImage}
      />

      <ImageLightbox
        src={lightboxSrc}
        alt={
          lightboxSrc === characterAvatarUrl
            ? `${config.character.name} portrait`
            : lightboxSrc === customImage
              ? "Uploaded scene"
              : "Scene"
        }
        open={lightboxSrc !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeLightbox();
            focusComposer();
          }
        }}
      />

      <Composer
        chatId={chatId}
        hasMessages={hasMessages}
        onSend={handleSend}
        onStop={generation.stop}
        onImpersonate={handleImpersonate}
        onImagePrompt={handleImagePrompt}
        isStreaming={localStreaming}
        isFinalizing={ownsGeneration && generation.status === "finalizing"}
        impersonatePending={impersonateMutation.isPending}
        imagePromptPending={imagePromptMutation.isPending}
        disabled={composerDisabled}
        characterName={config.character.name}
      />

      <SettingsPanel
        chatId={chatId}
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) focusComposer();
        }}
      />
    </main>
  );
}
