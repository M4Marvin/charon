import type { ChatMessage, ChatTree } from "@/lib/st-core/shared/types";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getActivePath, getSiblings } from "@/lib/st-core/chat-tree/tree";
import type { ActivePathEntry } from "./types";

export function computeActivePathFromMessages(messages: ChatMessage[]): ActivePathEntry[] {
  if (messages.length === 0) return [];
  const tree = treeFromNodes(messages);
  return computeActivePath(tree);
}

export function computeActivePath(tree: ChatTree): ActivePathEntry[] {
  const path = getActivePath(tree);
  return path
    .filter((msg) => msg.role !== "system")
    .map((msg) => {
      const siblings = getSiblings(tree, msg.localId);
      const idx = siblings.findIndex((s) => s.localId === msg.localId);
      return {
        message: msg,
        siblingIndex: idx,
        siblingTotal: siblings.length,
      };
    });
}

export function getPathToNode(tree: ChatTree, nodeId: number): ChatMessage[] {
  const path: ChatMessage[] = [];
  let current: ChatMessage | undefined = tree.get(nodeId);
  while (current !== undefined) {
    path.unshift(current);
    if (current.parentLocalId === null) break;
    current = tree.get(current.parentLocalId);
  }
  return path;
}
