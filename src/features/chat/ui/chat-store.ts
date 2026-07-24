import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ChatUiState {
  settingsOpen: boolean;
  inputDrafts: Record<string, string>;
  activePlaceholderId: number | null;
  portraitOpen: boolean;
  sceneOpen: boolean;
  lightboxSrc: string | null;
  shortcutsOpen: boolean;
  customImages: Record<string, string>;

  setSettingsOpen: (open: boolean) => void;
  toggleSettings: () => void;
  setInputDraft: (chatId: string, value: string) => void;
  clearInputDraft: (chatId: string) => void;
  setPlaceholder: (id: number) => void;
  clearPlaceholder: () => void;
  togglePortrait: () => void;
  toggleScene: () => void;
  setPortraitOpen: (open: boolean) => void;
  setSceneOpen: (open: boolean) => void;
  openLightbox: (src: string) => void;
  closeLightbox: () => void;
  setShortcutsOpen: (open: boolean) => void;
  setCustomImage: (chatId: string, dataUrl: string) => void;
  clearCustomImage: (chatId: string) => void;
}

export const useChatUiStore = create<ChatUiState>()(
  persist(
    (set) => ({
      settingsOpen: false,
      inputDrafts: {},
      activePlaceholderId: null,
      portraitOpen: false,
      sceneOpen: false,
      lightboxSrc: null,
      shortcutsOpen: false,
      customImages: {},

      setSettingsOpen: (open) => set({ settingsOpen: open }),
      toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
      setInputDraft: (chatId, value) =>
        set((s) => ({ inputDrafts: { ...s.inputDrafts, [chatId]: value } })),
      clearInputDraft: (chatId) =>
        set((s) => {
          const next = { ...s.inputDrafts };
          delete next[chatId];
          return { inputDrafts: next };
        }),
      setPlaceholder: (id) => set({ activePlaceholderId: id }),
      clearPlaceholder: () => set({ activePlaceholderId: null }),
      togglePortrait: () => set((s) => ({ portraitOpen: !s.portraitOpen })),
      toggleScene: () => set((s) => ({ sceneOpen: !s.sceneOpen })),
      setPortraitOpen: (open) => set({ portraitOpen: open }),
      setSceneOpen: (open) => set({ sceneOpen: open }),
      openLightbox: (src) => set({ lightboxSrc: src }),
      closeLightbox: () => set({ lightboxSrc: null }),
      setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
      setCustomImage: (chatId, dataUrl) =>
        set((s) => ({ customImages: { ...s.customImages, [chatId]: dataUrl } })),
      clearCustomImage: (chatId) =>
        set((s) => {
          const next = { ...s.customImages };
          delete next[chatId];
          return { customImages: next };
        }),
    }),
    {
      name: "chat-ui",
      partialize: (s) => ({
        customImages: s.customImages,
        inputDrafts: s.inputDrafts,
        portraitOpen: s.portraitOpen,
        sceneOpen: s.sceneOpen,
      }),
    },
  ),
);

export const selectSettingsOpen = (s: ChatUiState) => s.settingsOpen;
export const selectInputDraft =
  (chatId: string) =>
  (s: ChatUiState): string =>
    s.inputDrafts[chatId] ?? "";
export const selectActivePlaceholderId = (s: ChatUiState) => s.activePlaceholderId;
export const selectPortraitOpen = (s: ChatUiState) => s.portraitOpen;
export const selectSceneOpen = (s: ChatUiState) => s.sceneOpen;
export const selectLightboxSrc = (s: ChatUiState) => s.lightboxSrc;
export const selectShortcutsOpen = (s: ChatUiState) => s.shortcutsOpen;
export const selectCustomImages = (s: ChatUiState) => s.customImages;
