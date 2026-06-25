import type { ChatMessage, ChatTree } from "../shared/types.js";
import { warn } from "../shared/logger.js";

/** Create an empty chat tree. */
export function createTree(): ChatTree {
  return new Map();
}

/**
 * Get the root node id of the tree.
 * Returns undefined if the tree is empty, warns if multiple roots exist.
 */
export function getRootId(tree: ChatTree): number | undefined {
  let root: number | undefined;
  for (const [id, node] of tree) {
    if (node.parent_id === null || node.parent_id === undefined) {
      if (root !== undefined) {
        warn(`getRootId: multiple roots found (${root} and ${id}). Tree may be corrupt.`);
      }
      root ??= id;
    }
  }
  return root;
}

/**
 * Get the next available numeric id.
 * Uses a loop instead of Math.max spread to avoid stack limits with large trees.
 */
export function getNextId(tree: ChatTree): number {
  let max = -1;
  for (const id of tree.keys()) {
    if (id > max) max = id;
  }
  return max + 1;
}

/** Get a node by id, or throw if missing. */
export function getNode(tree: ChatTree, id: number): ChatMessage {
  const node = tree.get(id);
  if (!node) throw new Error(`Node ${id} not found in tree`);
  return node;
}

/**
 * Walk the tree from an optional leaf back to root.
 * If activeLeafId is omitted, uses the deepest selected_child chain from root.
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
    currentId = node.parent_id;
  }

  return path;
}

/**
 * Starting from root, follow selected_child_id to find the deepest selected leaf.
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
    if (node.selected_child_id === null || node.selected_child_id === undefined) return currentId;
    currentId = node.selected_child_id;
  }

  return currentId;
}

/** Get the next sibling (to the right) in the parent's children list. */
export function getNextSiblingId(tree: ChatTree, nodeId: number): number | null {
  const node = tree.get(nodeId);
  if (!node || node.parent_id === null || node.parent_id === undefined) return null;

  const parent = tree.get(node.parent_id);
  if (!parent) return null;

  const index = parent.children.indexOf(nodeId);
  if (index === -1) return null;
  return parent.children[index + 1] ?? null;
}

/** Get the previous sibling (to the left) in the parent's children list. */
export function getPrevSiblingId(tree: ChatTree, nodeId: number): number | null {
  const node = tree.get(nodeId);
  if (!node || node.parent_id === null || node.parent_id === undefined) return null;

  const parent = tree.get(node.parent_id);
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

  const parent = tree.get(node.parent_id ?? -1);
  if (!parent) return [node];

  const siblings: ChatMessage[] = [];
  for (const childId of parent.children) {
    const child = tree.get(childId);
    if (child) {
      siblings.push(child);
    } else {
      warn(`getSiblings: child ${childId} listed in parent ${parent.id} but not found in tree`);
    }
  }
  return siblings;
}

/** Add a child node to a parent. Overwrites selected_child_id to the new child. */
export function addChild(tree: ChatTree, parentId: number, node: ChatMessage): ChatMessage {
  node.parent_id = parentId;
  if (!Array.isArray(node.children)) node.children = [];
  node.selected_child_id = null;

  const parent = tree.get(parentId);
  if (!parent) {
    throw new Error(`addChild: parent ${parentId} not found`);
  }
  if (!Array.isArray(parent.children)) parent.children = [];

  if (tree.has(node.id)) {
    throw new Error(`addChild: node ${node.id} already exists in tree`);
  }

  parent.children.push(node.id);
  parent.selected_child_id = node.id;
  tree.set(node.id, node);
  return node;
}

/**
 * Add a sibling node under the same parent.
 * Inserts after the given nodeId in the children list.
 */
export function addSibling(tree: ChatTree, nodeId: number, node: ChatMessage): ChatMessage {
  const existing = tree.get(nodeId);
  if (!existing) throw new Error(`addSibling: node ${nodeId} not found`);

  if (tree.has(node.id)) {
    throw new Error(`addSibling: node ${node.id} already exists in tree`);
  }

  node.parent_id = existing.parent_id;
  if (!Array.isArray(node.children)) node.children = [];
  node.selected_child_id = null;

  const parent = tree.get(existing.parent_id ?? -1);
  if (!parent) throw new Error(`addSibling: parent ${existing.parent_id} not found`);

  const index = parent.children.indexOf(nodeId);
  if (index === -1) {
    parent.children.push(node.id);
  } else {
    parent.children.splice(index + 1, 0, node.id);
  }

  tree.set(node.id, node);
  return node;
}

/**
 * Select a specific child of a parent. Updates selected_child_id.
 */
export function selectChild(tree: ChatTree, parentId: number, childId: number): void {
  const parent = tree.get(parentId);
  if (!parent) throw new Error(`selectChild: parent ${parentId} not found`);

  if (!parent.children.includes(childId)) {
    throw new Error(`selectChild: ${childId} is not a child of ${parentId}`);
  }

  parent.selected_child_id = childId;
}

/**
 * Delete a node and all its descendants from the tree.
 * Updates the parent's children list and selected_child_id.
 */
export function deleteSubtree(tree: ChatTree, nodeId: number): void {
  const node = tree.get(nodeId);
  if (!node) return;

  // Recursively delete children
  for (const childId of node.children.slice()) {
    deleteSubtree(tree, childId);
  }

  // Remove from parent's children list
  if (node.parent_id !== null && node.parent_id !== undefined) {
    const parent = tree.get(node.parent_id);
    if (parent) {
      const index = parent.children.indexOf(nodeId);
      if (index !== -1) {
        // Save the intended next selection before splicing
        const nextSelection = parent.children[index + 1] ?? parent.children[index - 1] ?? null;
        parent.children.splice(index, 1);
        if (parent.selected_child_id === nodeId) {
          parent.selected_child_id = nextSelection;
        }
      }
    }
  }

  tree.delete(nodeId);
}

/** Replace a node in the tree (same id, new data). */
export function replaceNode(tree: ChatTree, node: ChatMessage): void {
  if (!tree.has(node.id)) throw new Error(`replaceNode: node ${node.id} not found`);
  tree.set(node.id, node);
}
