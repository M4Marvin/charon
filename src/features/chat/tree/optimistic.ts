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

/**
 * Optimistic delete transform for the messages query cache.
 *
 * Mirrors the server's `removeBranch` + `deleteSubtree`
 * (`tree/service.ts`, `operations.ts`, st-core `tree.ts`):
 * collects the target subtree via the `children` arrays, removes those
 * rows, splices the target out of its parent's `children`, and reselects
 * `children[i+1] ?? children[i-1] ?? null` when the deleted node was the
 * selected child. Returns `null` for root/unknown nodes (server rejects).
 */
export function applyDeleteOptimistic(
  rows: ChatMessageRow[],
  messageLocalId: number,
): ChatMessageRow[] | null {
  if (messageLocalId === 0) return null;
  const target = rows.find((r) => r.localId === messageLocalId);
  if (!target || target.parentLocalId === null) return null;
  const parent = rows.find((r) => r.localId === target.parentLocalId);
  if (!parent) return null;

  const byId = new Map(rows.map((r) => [r.localId, r]));
  const deleted = new Set<number>();
  const stack = [messageLocalId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (deleted.has(id)) continue;
    const node = byId.get(id);
    if (!node) continue;
    deleted.add(id);
    for (const childId of node.children) stack.push(childId);
  }

  const idx = parent.children.indexOf(messageLocalId);
  const nextSelection = parent.children[idx + 1] ?? parent.children[idx - 1] ?? null;
  const nextChildren = parent.children.filter((id) => id !== messageLocalId);

  return rows
    .filter((r) => !deleted.has(r.localId))
    .map((r) =>
      r.localId === parent.localId
        ? {
            ...r,
            children: nextChildren,
            selectedChildLocalId:
              r.selectedChildLocalId === messageLocalId ? nextSelection : r.selectedChildLocalId,
          }
        : r,
    );
}
