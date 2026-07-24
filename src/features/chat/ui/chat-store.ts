import { create } from "zustand";

export interface ChatUiState {
  settingsOpen: boolean;
  input: string;
  activePlaceholderId: number | null;
  portraitOpen: boolean;
  sceneOpen: boolean;
  lightboxSrc: string | null;

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
}

export const useChatUiStore = create<ChatUiState>()((set) => ({
  settingsOpen: false,
  input: "",
  activePlaceholderId: null,
  portraitOpen: false,
  sceneOpen: false,
  lightboxSrc: null,

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
}));

export const selectSettingsOpen = (s: ChatUiState) => s.settingsOpen;
export const selectInput = (s: ChatUiState) => s.input;
export const selectActivePlaceholderId = (s: ChatUiState) => s.activePlaceholderId;
export const selectPortraitOpen = (s: ChatUiState) => s.portraitOpen;
export const selectSceneOpen = (s: ChatUiState) => s.sceneOpen;
export const selectLightboxSrc = (s: ChatUiState) => s.lightboxSrc;
