import type { ChatMessage, ChatTree } from '../shared/types.js';
import { getRootId, getActiveLeafId } from './tree.js';

/** Deserialize a flat node array into a Map. */
export function treeFromNodes(nodes: ChatMessage[]): ChatTree {
  const tree: ChatTree = new Map();
  for (const node of nodes) {
    tree.set(node.id, { ...node, children: [...(node.children ?? [])] });
  }
  return tree;
}

/** Serialize a tree to a flat array of all nodes (all branches). */
export function treeToNodes(tree: ChatTree): ChatMessage[] {
  return Array.from(tree.values());
}

/** Serialize only the active path (no siblings). */
export function treeToActivePath(tree: ChatTree): ChatMessage[] {
  const rootId = getRootId(tree);
  if (rootId === undefined) return [];
  const leafId = getActiveLeafId(tree, rootId);
  if (leafId === null) return [];

  const path: ChatMessage[] = [];
  let currentId: number | null = leafId;

  while (currentId !== null && currentId !== undefined) {
    const node = tree.get(currentId);
    if (!node) break;
    path.unshift(node);
    currentId = node.parent_id;
  }

  return path;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate tree integrity.
 * Checks: single root, all children present, no dangling parent refs, no cycles, no duplicate children.
 */
export function validateTree(tree: ChatTree): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Find roots
  const roots: number[] = [];
  for (const [id, node] of tree) {
    if (node.parent_id === null || node.parent_id === undefined) {
      roots.push(id);
    }
  }

  if (roots.length === 0) {
    errors.push('No root node found (every node has a parent)');
  } else if (roots.length > 1) {
    errors.push(`Multiple root nodes found: ${roots.join(', ')}`);
  }

  // 2. Check children arrays
  for (const [id, node] of tree) {
    if (!Array.isArray(node.children)) {
      errors.push(`Node ${id}: children is not an array`);
      continue;
    }

    // Check for duplicate children
    const seen = new Set<number>();
    for (const childId of node.children) {
      if (seen.has(childId)) {
        errors.push(`Node ${id}: duplicate child ${childId}`);
        continue;
      }
      seen.add(childId);

      // Check child exists
      const child = tree.get(childId);
      if (!child) {
        errors.push(`Node ${id}: child ${childId} not found in tree`);
      } else if (child.parent_id !== id) {
        errors.push(
          `Node ${id}: child ${childId} has parent_id ${child.parent_id}, expected ${id}`,
        );
      }
    }

    // Check selected_child_id
    if (node.selected_child_id !== null && node.selected_child_id !== undefined) {
      if (!node.children.includes(node.selected_child_id)) {
        errors.push(`Node ${id}: selected_child_id ${node.selected_child_id} not in children list`);
      }
    }
  }

  // 3. Cycle detection via DFS
  const visited = new Set<number>();
  const recStack = new Set<number>();

  function dfs(nodeId: number): boolean {
    visited.add(nodeId);
    recStack.add(nodeId);
    const node = tree.get(nodeId);
    if (node) {
      for (const childId of node.children) {
        if (!visited.has(childId)) {
          if (dfs(childId)) {
            errors.push(`Cycle detected involving node ${childId}`);
            return true;
          }
        } else if (recStack.has(childId)) {
          errors.push(`Cycle detected: node ${childId} is visited again in current path`);
          return true;
        }
      }
    }
    recStack.delete(nodeId);
    return false;
  }

  for (const root of roots) {
    if (!visited.has(root)) dfs(root);
  }

  // Check unreachable nodes
  for (const id of tree.keys()) {
    if (!visited.has(id)) {
      warnings.push(`Node ${id} is unreachable from any root`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
