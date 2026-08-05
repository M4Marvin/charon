import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import {
  deleteCustomImageFromDb,
  getAllCustomImages,
  setCustomImageInDb,
} from "./custom-image-store";

// localStorage writes throw QuotaExceededError once the ~5MB quota is full.
// Custom images no longer live in localStorage (see custom-image-store.ts), but
// a storage failure must never crash the app again — swallow and warn instead.
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(name);
    } catch (error) {
      console.warn("[chat-ui] localStorage read failed", error);
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(name, String(value));
    } catch (error) {
      console.warn("[chat-ui] localStorage write failed (quota exceeded?)", error);
    }
  },
  removeItem: (name) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(name);
    } catch (error) {
      console.warn("[chat-ui] localStorage remove failed", error);
    }
  },
};

export interface ChatUiState {
  settingsOpen: boolean;
  inputDrafts: Record<string, string>;
  activePlaceholderId: number | null;
  portraitOpen: boolean;
  sceneOpen: boolean;
  lightboxSrc: string | null;
  customImages: Record<string, string>;
  /** Incremented to signal the composer to refocus (see Composer focus effect). */
  composerFocusNonce: number;

  setSettingsOpen: (open: boolean) => void;
  toggleSettings: () => void;
  setInputDraft: (chatId: string, value: string) => void;
  clearInputDraft: (chatId: string) => void;
  setPlaceholder: (id: number) => void;
  clearPlaceholder: () => void;
  focusComposer: () => void;
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
      inputDrafts: {},
      activePlaceholderId: null,
      portraitOpen: false,
      sceneOpen: false,
      lightboxSrc: null,
      customImages: {},
      composerFocusNonce: 0,

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
      focusComposer: () => set((s) => ({ composerFocusNonce: s.composerFocusNonce + 1 })),
      togglePortrait: () => set((s) => ({ portraitOpen: !s.portraitOpen })),
      toggleScene: () => set((s) => ({ sceneOpen: !s.sceneOpen })),
      setPortraitOpen: (open) => set({ portraitOpen: open }),
      setSceneOpen: (open) => set({ sceneOpen: open }),
      openLightbox: (src) => set({ lightboxSrc: src }),
      closeLightbox: () => set({ lightboxSrc: null }),
      setCustomImage: (chatId, dataUrl) => {
        set((s) => ({ customImages: { ...s.customImages, [chatId]: dataUrl } }));
        setCustomImageInDb(chatId, dataUrl).catch((error) => {
          console.warn("[chat-ui] failed to persist custom image", error);
        });
      },
      clearCustomImage: (chatId) => {
        set((s) => {
          const next = { ...s.customImages };
          delete next[chatId];
          return { customImages: next };
        });
        deleteCustomImageFromDb(chatId).catch((error) => {
          console.warn("[chat-ui] failed to delete custom image", error);
        });
      },
    }),
    {
      name: "chat-ui",
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => ({
        inputDrafts: s.inputDrafts,
        portraitOpen: s.portraitOpen,
        sceneOpen: s.sceneOpen,
      }),
    },
  ),
);

async function hydrateCustomImages() {
  if (typeof indexedDB === "undefined") return;
  try {
    const images = await getAllCustomImages();
    // In-memory images (including any rehydrated from the old localStorage
    // layout) win over IndexedDB, so a fresh upload isn't clobbered.
    useChatUiStore.setState((s) => ({ customImages: { ...images, ...s.customImages } }));
  } catch (error) {
    console.warn("[chat-ui] failed to hydrate custom images", error);
  }
}

void hydrateCustomImages();

export const selectSettingsOpen = (s: ChatUiState) => s.settingsOpen;
export const selectInputDraft =
  (chatId: string) =>
  (s: ChatUiState): string =>
    s.inputDrafts[chatId] ?? "";
export const selectActivePlaceholderId = (s: ChatUiState) => s.activePlaceholderId;
export const selectPortraitOpen = (s: ChatUiState) => s.portraitOpen;
export const selectSceneOpen = (s: ChatUiState) => s.sceneOpen;
export const selectLightboxSrc = (s: ChatUiState) => s.lightboxSrc;
export const selectComposerFocusNonce = (s: ChatUiState) => s.composerFocusNonce;
export const selectCustomImages = (s: ChatUiState) => s.customImages;
