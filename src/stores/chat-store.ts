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
  sidebarOpen: boolean;
  input: string;

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
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setInput: (v: string) => void;
  clearInput: () => void;

  // Streaming lifecycle. `send` (prepareStream success) sets the placeholder
  // AND bumps the trigger counter so the page's useAiChat knows to start a
  // stream. `clearPlaceholder` resets after finalize/cancel/error.
  setPlaceholder: (id: number) => void;
  clearPlaceholder: () => void;
  markRecovered: (chatId: string, placeholderId: number) => void;
  clearRecovered: () => void;
}

export const useChatStore = create<ChatStoreState>((set) => ({
  sidebarOpen: false,
  input: "",
  activePlaceholderId: null,
  recoveredStaleId: null,
  recoveredFor: null,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setInput: (v) => set({ input: v }),
  clearInput: () => set({ input: "" }),

  setPlaceholder: (id) => set({ activePlaceholderId: id }),
  clearPlaceholder: () => set({ activePlaceholderId: null }),
  markRecovered: (chatId, placeholderId) =>
    set({ recoveredStaleId: placeholderId, recoveredFor: chatId }),
  clearRecovered: () => set({ recoveredStaleId: null, recoveredFor: null }),
}));

// Convenience selectors — components subscribe to narrow slices.
export const selectSidebarOpen = (s: ChatStoreState) => s.sidebarOpen;
export const selectInput = (s: ChatStoreState) => s.input;
export const selectActivePlaceholderId = (s: ChatStoreState) => s.activePlaceholderId;
export const selectRecovered = (s: ChatStoreState) => ({
  id: s.recoveredStaleId,
  for: s.recoveredFor,
});
