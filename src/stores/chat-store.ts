import { create } from "zustand";

// UI state for the chat page. The page wires TanStack Query mutations and
// useAiChat to these actions — the store itself is framework-agnostic.
//
// Why a store:
//   - Reads are synchronous (getState()), so the streaming connection's body
//     getter never lags a render like the old useState + useRef + useEffect
//     sync did. That's the bodyRef race fix.
//   - One place for chat UI state instead of 5 useState + 4 useRef in the page.
//   - Selectors keep components re-rendering only on the slice they care about.

export interface ChatStoreState {
  // ── UI ────────────────────────────────────────────────────────────────
  settingsOpen: boolean;
  input: string;

  // ── Custom images (per-chat, temporary, base64 data URLs) ──────────
  chatImages: Record<string, string>;

  // ── Streaming ─────────────────────────────────────────────────────────
  // The placeholder id the API should stream into. null when no stream active.
  // Read synchronously by fetchServerSentEvents's body getter.
  activePlaceholderId: number | null;
  // The last recovered stale placeholder id (so we can clear it once cancelled).
  recoveredStaleId: number | null;
  // Monotonic counter bumped on every recovery attempt so the mount effect
  // runs exactly once per chat id.
  recoveredFor: string | null;

  // ── Actions ──────────────────────────────────────────────────────────
  setSettingsOpen: (open: boolean) => void;
  toggleSettings: () => void;
  setInput: (v: string) => void;
  clearInput: () => void;

  // Streaming lifecycle. `send` (prepareStream success) sets the placeholder
  // AND bumps the trigger counter so the page's useAiChat knows to start a
  // stream. `clearPlaceholder` resets after finalize/cancel/error.
  setPlaceholder: (id: number) => void;
  clearPlaceholder: () => void;
  markRecovered: (chatId: string, placeholderId: number) => void;
  clearRecovered: () => void;

  // ── Custom images ─────────────────────────────────────────────────
  setChatImage: (chatId: string, base64: string) => void;
  clearChatImage: (chatId: string) => void;
}

export const useChatStore = create<ChatStoreState>((set) => ({
  settingsOpen: false,
  input: "",
  chatImages: {},
  activePlaceholderId: null,
  recoveredStaleId: null,
  recoveredFor: null,

  setSettingsOpen: (open) => set({ settingsOpen: open }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  setInput: (v) => set({ input: v }),
  clearInput: () => set({ input: "" }),

  setPlaceholder: (id) => set({ activePlaceholderId: id }),
  clearPlaceholder: () => set({ activePlaceholderId: null }),
  markRecovered: (chatId, placeholderId) =>
    set({ recoveredStaleId: placeholderId, recoveredFor: chatId }),
  clearRecovered: () => set({ recoveredStaleId: null, recoveredFor: null }),

  setChatImage: (chatId, base64) =>
    set((s) => ({ chatImages: { ...s.chatImages, [chatId]: base64 } })),
  clearChatImage: (chatId) =>
    set((s) => {
      const next = { ...s.chatImages };
      delete next[chatId];
      return { chatImages: next };
    }),
}));

// Convenience selectors — components subscribe to narrow slices.
export const selectSettingsOpen = (s: ChatStoreState) => s.settingsOpen;
export const selectInput = (s: ChatStoreState) => s.input;
export const selectActivePlaceholderId = (s: ChatStoreState) => s.activePlaceholderId;
export const selectRecovered = (s: ChatStoreState) => ({
  id: s.recoveredStaleId,
  for: s.recoveredFor,
});
