import type { ChatMessage, ChatTree } from "@/lib/st-core/shared/types";
import {
  addChild,
  addSibling,
  deleteSubtree,
  getNextId,
  getNode,
  getNextSiblingId,
  getPrevSiblingId,
  getActiveLeafId,
  selectChild,
} from "@/lib/st-core/chat-tree/tree";
import type { NewMessage, SiblingContent } from "./types";

function assertNotRoot(localId: number): void {
  if (localId === 0) throw new Error("Cannot operate on the hidden root (localId 0)");
}

export function appendChild(tree: ChatTree, parentId: number, msg: NewMessage): ChatMessage {
  const node: ChatMessage = {
    localId: getNextId(tree),
    parentLocalId: null,
    children: [],
    selectedChildLocalId: null,
    role: msg.role,
    content: msg.content,
    ...(msg.extra ? { extra: msg.extra } : {}),
  };
  addChild(tree, parentId, node);
  return node;
}

export function appendToActiveLeaf(tree: ChatTree, msg: NewMessage): ChatMessage {
  const activeLeafId = getActiveLeafId(tree);
  if (activeLeafId === null) throw new Error("No active message to append to");
  return appendChild(tree, activeLeafId, msg);
}

export function selectSibling(
  tree: ChatTree,
  messageLocalId: number,
  direction: "next" | "prev",
): ChatMessage | null {
  assertNotRoot(messageLocalId);
  const target = getNode(tree, messageLocalId);
  if (target.parentLocalId === null) throw new Error("Cannot swipe the root message");

  const siblingId =
    direction === "next"
      ? getNextSiblingId(tree, messageLocalId)
      : getPrevSiblingId(tree, messageLocalId);

  if (siblingId === null) return null;

  selectChild(tree, target.parentLocalId, siblingId);
  return getNode(tree, siblingId);
}

export function createSiblingAndSelect(
  tree: ChatTree,
  targetId: number,
  msg: SiblingContent,
): ChatMessage {
  const target = getNode(tree, targetId);
  if (target.parentLocalId === null) throw new Error("Cannot create sibling of root");

  const node: ChatMessage = {
    localId: getNextId(tree),
    parentLocalId: null,
    children: [],
    selectedChildLocalId: null,
    role: msg.role,
    content: msg.content,
    ...(msg.extra ? { extra: msg.extra } : {}),
  };
  addSibling(tree, targetId, node);
  selectChild(tree, target.parentLocalId, node.localId);
  return node;
}

export function removeBranch(tree: ChatTree, messageLocalId: number): number[] {
  assertNotRoot(messageLocalId);
  const target = getNode(tree, messageLocalId);
  if (target.parentLocalId === null) throw new Error("Cannot delete the root message");

  const ids: number[] = [];
  const stack = [messageLocalId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const node = tree.get(id);
    if (!node) continue;
    ids.push(id);
    for (const childId of node.children) stack.push(childId);
  }

  deleteSubtree(tree, messageLocalId);
  return ids;
}

export function editContent(tree: ChatTree, messageLocalId: number, content: string): void {
  assertNotRoot(messageLocalId);
  getNode(tree, messageLocalId).content = content;
}
