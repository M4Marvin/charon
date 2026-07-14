import type { ChatMessage, ChatTree } from "../shared/types.js";
import { warn } from "../shared/logger.js";

/** Create an empty chat tree. */
export function createTree(): ChatTree {
  return new Map();
}

/**
 * Get the root node localId of the tree.
 * Returns undefined if the tree is empty, warns if multiple roots exist.
 */
export function getRootId(tree: ChatTree): number | undefined {
  let root: number | undefined;
  for (const [localId, node] of tree) {
    if (node.parentLocalId === null || node.parentLocalId === undefined) {
      if (root !== undefined) {
        warn(`getRootId: multiple roots found (${root} and ${localId}). Tree may be corrupt.`);
      }
      root ??= localId;
    }
  }
  return root;
}

/**
 * Get the next available numeric localId.
 * Uses a loop instead of Math.max spread to avoid stack limits with large trees.
 */
export function getNextId(tree: ChatTree): number {
  let max = -1;
  for (const localId of tree.keys()) {
    if (localId > max) max = localId;
  }
  return max + 1;
}

/** Get a node by localId, or throw if missing. */
export function getNode(tree: ChatTree, localId: number): ChatMessage {
  const node = tree.get(localId);
  if (!node) throw new Error(`Node ${localId} not found in tree`);
  return node;
}

/**
 * Walk the tree from an optional leaf back to root.
 * If activeLeafId is omitted, uses the deepest selectedChildLocalId chain from root.
 * Throws on cycles.
 */
export function getActivePath(tree: ChatTree, activeLeafId?: number | null): ChatMessage[] {
  const rootId = getRootId(tree);
  if (rootId === undefined) return [];

  let currentId: number | null | undefined = activeLeafId;
  if (currentId === null || currentId === undefined) {
    currentId = getActiveLeafId(tree, rootId);
  }
  if (currentId === null || currentId === undefined) return [];

  const path: ChatMessage[] = [];
  const visited = new Set<number>();

  while (currentId !== null && currentId !== undefined) {
    if (visited.has(currentId)) {
      throw new Error(`Cycle detected in chat tree at node ${currentId}`);
    }
    visited.add(currentId);
    const node = tree.get(currentId);
    if (!node) break;
    path.unshift(node);
    currentId = node.parentLocalId;
  }

  return path;
}

/**
 * Starting from root, follow selectedChildLocalId to find the deepest selected leaf.
 * Throws on cycles.
 */
export function getActiveLeafId(tree: ChatTree, rootId?: number | null): number | null {
  if (rootId === null || rootId === undefined) {
    rootId = getRootId(tree);
  }
  if (rootId === undefined) return null;

  const visited = new Set<number>();
  let currentId: number | null = rootId;

  while (currentId !== null && currentId !== undefined) {
    if (visited.has(currentId)) {
      throw new Error(`Cycle detected in chat tree at node ${currentId}`);
    }
    visited.add(currentId);
    const node = tree.get(currentId);
    if (!node) return currentId;
    if (node.selectedChildLocalId === null || node.selectedChildLocalId === undefined) return currentId;
    currentId = node.selectedChildLocalId;
  }

  return currentId;
}

/** Get the next sibling (to the right) in the parent's children list. */
export function getNextSiblingId(tree: ChatTree, nodeId: number): number | null {
  const node = tree.get(nodeId);
  if (!node || node.parentLocalId === null || node.parentLocalId === undefined) return null;

  const parent = tree.get(node.parentLocalId);
  if (!parent) return null;

  const index = parent.children.indexOf(nodeId);
  if (index === -1) return null;
  return parent.children[index + 1] ?? null;
}

/** Get the previous sibling (to the left) in the parent's children list. */
export function getPrevSiblingId(tree: ChatTree, nodeId: number): number | null {
  const node = tree.get(nodeId);
  if (!node || node.parentLocalId === null || node.parentLocalId === undefined) return null;

  const parent = tree.get(node.parentLocalId);
  if (!parent) return null;

  const index = parent.children.indexOf(nodeId);
  if (index === -1) return null;
  return parent.children[index - 1] ?? null;
}

/**
 * Get all siblings of a node (including the node itself).
 * If the parent is missing, returns [node].
 */
export function getSiblings(tree: ChatTree, nodeId: number): ChatMessage[] {
  const node = tree.get(nodeId);
  if (!node) return [];

  const parent = tree.get(node.parentLocalId ?? -1);
  if (!parent) return [node];

  const siblings: ChatMessage[] = [];
  for (const childId of parent.children) {
    const child = tree.get(childId);
    if (child) {
      siblings.push(child);
    } else {
      warn(`getSiblings: child ${childId} listed in parent ${parent.localId} but not found in tree`);
    }
  }
  return siblings;
}

/** Add a child node to a parent. Overwrites selectedChildLocalId to the new child. */
export function addChild(tree: ChatTree, parentId: number, node: ChatMessage): ChatMessage {
  node.parentLocalId = parentId;
  if (!Array.isArray(node.children)) node.children = [];
  node.selectedChildLocalId = null;

  const parent = tree.get(parentId);
  if (!parent) {
    throw new Error(`addChild: parent ${parentId} not found`);
  }
  if (!Array.isArray(parent.children)) parent.children = [];

  if (tree.has(node.localId)) {
    throw new Error(`addChild: node ${node.localId} already exists in tree`);
  }

  parent.children.push(node.localId);
  parent.selectedChildLocalId = node.localId;
  tree.set(node.localId, node);
  return node;
}

/**
 * Add a sibling node under the same parent.
 * Inserts after the given nodeId in the children list.
 */
export function addSibling(tree: ChatTree, nodeId: number, node: ChatMessage): ChatMessage {
  const existing = tree.get(nodeId);
  if (!existing) throw new Error(`addSibling: node ${nodeId} not found`);

  if (tree.has(node.localId)) {
    throw new Error(`addSibling: node ${node.localId} already exists in tree`);
  }

  node.parentLocalId = existing.parentLocalId;
  if (!Array.isArray(node.children)) node.children = [];
  node.selectedChildLocalId = null;

  const parent = tree.get(existing.parentLocalId ?? -1);
  if (!parent) throw new Error(`addSibling: parent ${existing.parentLocalId} not found`);

  const index = parent.children.indexOf(nodeId);
  if (index === -1) {
    parent.children.push(node.localId);
  } else {
    parent.children.splice(index + 1, 0, node.localId);
  }

  tree.set(node.localId, node);
  return node;
}

/**
 * Select a specific child of a parent. Updates selectedChildLocalId.
 */
export function selectChild(tree: ChatTree, parentId: number, childId: number): void {
  const parent = tree.get(parentId);
  if (!parent) throw new Error(`selectChild: parent ${parentId} not found`);

  if (!parent.children.includes(childId)) {
    throw new Error(`selectChild: ${childId} is not a child of ${parentId}`);
  }

  parent.selectedChildLocalId = childId;
}

/**
 * Delete a node and all its descendants from the tree.
 * Updates the parent's children list and selectedChildLocalId.
 */
export function deleteSubtree(tree: ChatTree, nodeId: number): void {
  const node = tree.get(nodeId);
  if (!node) return;

  // Recursively delete children
  for (const childId of node.children.slice()) {
    deleteSubtree(tree, childId);
  }

  // Remove from parent's children list
  if (node.parentLocalId !== null && node.parentLocalId !== undefined) {
    const parent = tree.get(node.parentLocalId);
    if (parent) {
      const index = parent.children.indexOf(nodeId);
      if (index !== -1) {
        // Save the intended next selection before splicing
        const nextSelection = parent.children[index + 1] ?? parent.children[index - 1] ?? null;
        parent.children.splice(index, 1);
        if (parent.selectedChildLocalId === nodeId) {
          parent.selectedChildLocalId = nextSelection;
        }
      }
    }
  }

  tree.delete(nodeId);
}

/** Replace a node in the tree (same localId, new data). */
export function replaceNode(tree: ChatTree, node: ChatMessage): void {
  if (!tree.has(node.localId)) throw new Error(`replaceNode: node ${node.localId} not found`);
  tree.set(node.localId, node);
}
