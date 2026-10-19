import { useChatUiStore } from "./chat-store";

/**
 * Clears only the overlay state owned by this run. A stale terminal callback
 * must never clear a newer run's pending bubble or placeholder.
 */
export function clearGenerationOverlay(chatId: string, placeholderId: number | null): void {
  const store = useChatUiStore.getState();
  if (store.pendingSend?.chatId === chatId) store.clearPendingSend();
  if (placeholderId !== null && placeholderId > 0 && store.activePlaceholderId === placeholderId) {
    store.clearPlaceholder();
  }
}
