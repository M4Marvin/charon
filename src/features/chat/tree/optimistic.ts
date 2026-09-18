import type { ChatMessageRow } from "@/db/schema";
import { rowToMessage } from "@/lib/chat/rows";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getNode } from "@/lib/st-core/chat-tree/tree";
import { removeBranch, selectSibling } from "./operations";

/**
 * Optimistic swipe transform for the messages query cache.
 *
 * Delegates to the same `selectSibling` the server uses, so cache and
 * persistence cannot drift. Returns `null` when the swipe is a server no-op
 * (boundary, root, unknown node) so the caller writes nothing to the cache.
 *
 * `createIfMissing` swipes are a no-op here too: there is no existing
 * sibling to select until the server creates one, so the caller relies on
 * the post-mutation invalidation to surface the new branch.
 */
export function applySwipeOptimistic(
  rows: ChatMessageRow[],
  messageLocalId: number,
  direction: "next" | "prev",
): ChatMessageRow[] | null {
  if (messageLocalId === 0) return null;
  const target = rows.find((r) => r.localId === messageLocalId);
  if (!target || target.parentLocalId === null) return null;
  const parentId = target.parentLocalId;
  if (!rows.some((r) => r.localId === parentId)) return null;

  const tree = treeFromNodes(rows.map(rowToMessage));
  if (selectSibling(tree, messageLocalId, direction) === null) return null;

  const selectedChildLocalId = getNode(tree, parentId).selectedChildLocalId;
  return rows.map((r) => (r.localId === parentId ? { ...r, selectedChildLocalId } : r));
}

/**
 * Optimistic delete transform for the messages query cache.
 *
 * Delegates to the same `removeBranch` the server uses (subtree collection,
 * parent `children` splice and `children[i+1] ?? children[i-1] ?? null`
 * reselection). Returns `null` for root/unknown nodes (server rejects).
 */
export function applyDeleteOptimistic(
  rows: ChatMessageRow[],
  messageLocalId: number,
): ChatMessageRow[] | null {
  if (messageLocalId === 0) return null;
  const target = rows.find((r) => r.localId === messageLocalId);
  if (!target || target.parentLocalId === null) return null;
  const parentId = target.parentLocalId;
  if (!rows.some((r) => r.localId === parentId)) return null;

  const tree = treeFromNodes(rows.map(rowToMessage));
  removeBranch(tree, messageLocalId);

  return rows
    .filter((r) => tree.has(r.localId))
    .map((r) => {
      if (r.localId !== parentId) return r;
      const parent = getNode(tree, parentId);
      return {
        ...r,
        children: parent.children,
        selectedChildLocalId: parent.selectedChildLocalId,
      };
    });
}
