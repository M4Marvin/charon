import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ChatUiState {
  settingsOpen: boolean;
  input: string;
  activePlaceholderId: number | null;
  portraitOpen: boolean;
  sceneOpen: boolean;
  lightboxSrc: string | null;
  customImages: Record<string, string>;

  setSettingsOpen: (open: boolean) => void;
  toggleSettings: () => void;
  setInput: (v: string) => void;
  clearInput: () => void;
  setPlaceholder: (id: number) => void;
  clearPlaceholder: () => void;
  togglePortrait: () => void;
  toggleScene: () => void;
  setPortraitOpen: (open: boolean) => void;
  setSceneOpen: (open: boolean) => void;
  openLightbox: (src: string) => void;
  closeLightbox: () => void;
  setCustomImage: (chatId: string, dataUrl: string) => void;
  clearCustomImage: (chatId: string) => void;
}

export const useChatUiStore = create<ChatUiState>()(
  persist(
    (set) => ({
      settingsOpen: false,
      input: "",
      activePlaceholderId: null,
      portraitOpen: false,
      sceneOpen: false,
      lightboxSrc: null,
      customImages: {},

      setSettingsOpen: (open) => set({ settingsOpen: open }),
      toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
      setInput: (v) => set({ input: v }),
      clearInput: () => set({ input: "" }),
      setPlaceholder: (id) => set({ activePlaceholderId: id }),
      clearPlaceholder: () => set({ activePlaceholderId: null }),
      togglePortrait: () => set((s) => ({ portraitOpen: !s.portraitOpen })),
      toggleScene: () => set((s) => ({ sceneOpen: !s.sceneOpen })),
      setPortraitOpen: (open) => set({ portraitOpen: open }),
      setSceneOpen: (open) => set({ sceneOpen: open }),
      openLightbox: (src) => set({ lightboxSrc: src }),
      closeLightbox: () => set({ lightboxSrc: null }),
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
      partialize: (s) => ({ customImages: s.customImages }),
    },
  ),
);

export const selectSettingsOpen = (s: ChatUiState) => s.settingsOpen;
export const selectInput = (s: ChatUiState) => s.input;
export const selectActivePlaceholderId = (s: ChatUiState) => s.activePlaceholderId;
export const selectPortraitOpen = (s: ChatUiState) => s.portraitOpen;
export const selectSceneOpen = (s: ChatUiState) => s.sceneOpen;
export const selectLightboxSrc = (s: ChatUiState) => s.lightboxSrc;
export const selectCustomImages = (s: ChatUiState) => s.customImages;
