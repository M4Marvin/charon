import type { ChatMessageRow } from "@/db/schema";

/**
 * Optimistic swipe transform for the messages query cache.
 *
 * Mirrors the server's `selectSibling` persistence (`tree/service.ts`):
 * only the parent row's `selectedChildLocalId` changes. Returns `null`
 * when the swipe is a server no-op (boundary, root, unknown node) so the
 * caller writes nothing to the cache.
 */
export function applySwipeOptimistic(
  rows: ChatMessageRow[],
  messageLocalId: number,
  direction: "next" | "prev",
): ChatMessageRow[] | null {
  if (messageLocalId === 0) return null;
  const target = rows.find((r) => r.localId === messageLocalId);
  if (!target || target.parentLocalId === null) return null;
  const parent = rows.find((r) => r.localId === target.parentLocalId);
  if (!parent) return null;
  const idx = parent.children.indexOf(messageLocalId);
  if (idx === -1) return null;
  const sibling = direction === "next" ? parent.children[idx + 1] : parent.children[idx - 1];
  if (sibling === undefined) return null;
  return rows.map((r) =>
    r.localId === parent.localId ? { ...r, selectedChildLocalId: sibling } : r,
  );
}
