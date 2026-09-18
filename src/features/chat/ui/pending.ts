import type { ActivePathEntry } from "@/features/chat/tree/types";
import type { ChatUiState } from "./chat-store";

/**
 * Whether the instant-send overlay should render.
 *
 * Visible from `setPendingSend` until the server placeholder row arrives
 * in the messages cache (matched by `activePlaceholderId`). Callers must
 * clear the pending state alongside every `clearPlaceholder` — once the
 * placeholder is gone with pending still set, this returns true again.
 */
export function isPendingVisible(
  pending: ChatUiState["pendingSend"],
  chatId: string,
  entries: ActivePathEntry[],
  activePlaceholderId: number | null,
): boolean {
  if (!pending || pending.chatId !== chatId) return false;
  if (activePlaceholderId === null) return true;
  return !entries.some((e) => e.message.localId === activePlaceholderId);
}
