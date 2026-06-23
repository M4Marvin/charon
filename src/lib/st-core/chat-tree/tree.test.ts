import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setLogger, type Logger } from "@/lib/st-core/shared";
import {
  addChild,
  addSibling,
  createTree,
  deleteSubtree,
  getActiveLeafId,
  getActivePath,
  getNextId,
  getNextSiblingId,
  getNode,
  getPrevSiblingId,
  getRootId,
  getSiblings,
  replaceNode,
  selectChild,
  treeFromNodes,
  treeToActivePath,
  treeToNodes,
  validateTree,
} from "@/lib/st-core/chat-tree";
import type { ChatMessage, ChatTree } from "@/lib/st-core/shared";

function makeNode(id: number, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    parent_id: null,
    children: [],
    selected_child_id: null,
    role: "user",
    content: `msg-${id}`,
    ...overrides,
  };
}

function makeRoleNode(id: number, role: ChatMessage["role"], content: string): ChatMessage {
  return makeNode(id, { role, content });
}

interface CapturingLogger extends Logger {
  warnings: string[];
  errors: string[];
  infos: string[];
  reset: () => void;
}

function makeCapturingLogger(): CapturingLogger {
  const log: CapturingLogger = {
    warnings: [],
    errors: [],
    infos: [],
    reset() {
      this.warnings = [];
      this.errors = [];
      this.infos = [];
    },
    warn(msg) {
      this.warnings.push(msg);
    },
    error(msg) {
      this.errors.push(msg);
    },
    info(msg) {
      this.infos.push(msg);
    },
  };
  return log;
}

let capture: CapturingLogger;

beforeEach(() => {
  capture = makeCapturingLogger();
  setLogger(capture);
});

afterEach(() => {
  setLogger({
    warn: () => {},
    error: () => {},
    info: () => {},
  });
});

describe("createTree", () => {
  it("returns an empty Map", () => {
    const tree = createTree();
    expect(tree).toBeInstanceOf(Map);
    expect(tree.size).toBe(0);
  });
});

describe("getRootId", () => {
  it("returns undefined for an empty tree", () => {
    expect(getRootId(createTree())).toBeUndefined();
  });

  it("returns the id of a node with parent_id === null", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { parent_id: null }));
    expect(getRootId(tree)).toBe(0);
  });

  it("treats parent_id === undefined as a root", () => {
    const tree = createTree();
    tree.set(7, { id: 7, children: [], role: "user", content: "x" } as unknown as ChatMessage);
    expect(getRootId(tree)).toBe(7);
  });

  it("warns when multiple roots are present and returns the first", () => {
    const tree = createTree();
    tree.set(1, makeNode(1));
    tree.set(2, makeNode(2));
    expect(getRootId(tree)).toBe(1);
    expect(capture.warnings).toHaveLength(1);
    expect(capture.warnings[0]).toMatch(/multiple roots/i);
    expect(capture.warnings[0]).toMatch(/1/);
    expect(capture.warnings[0]).toMatch(/2/);
  });
});

describe("getNextId", () => {
  it("returns 0 for an empty tree", () => {
    expect(getNextId(createTree())).toBe(0);
  });

  it("returns max+1 for contiguous ids", () => {
    const tree = createTree();
    tree.set(0, makeNode(0));
    tree.set(1, makeNode(1));
    tree.set(2, makeNode(2));
    expect(getNextId(tree)).toBe(3);
  });

  it("returns max+1 for non-contiguous ids (not count-based)", () => {
    const tree = createTree();
    tree.set(0, makeNode(0));
    tree.set(5, makeNode(5));
    tree.set(2, makeNode(2));
    expect(getNextId(tree)).toBe(6);
  });

  it("handles all-negative ids", () => {
    const tree = createTree();
    tree.set(-3, makeNode(-3));
    tree.set(-1, makeNode(-1));
    expect(getNextId(tree)).toBe(0);
  });
});

describe("getNode", () => {
  it("returns the node when present", () => {
    const tree = createTree();
    const n = makeNode(0, { content: "hello" });
    tree.set(0, n);
    expect(getNode(tree, 0)).toBe(n);
  });

  it("throws when the node is missing", () => {
    const tree = createTree();
    expect(() => getNode(tree, 99)).toThrow(/Node 99 not found/);
  });
});

describe("getActiveLeafId", () => {
  it("returns null for an empty tree", () => {
    expect(getActiveLeafId(createTree())).toBeNull();
  });

  it("returns the root when root has no selected_child_id", () => {
    const tree = createTree();
    tree.set(0, makeNode(0));
    expect(getActiveLeafId(tree)).toBe(0);
  });

  it("follows the selected_child_id chain to the deepest leaf", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { selected_child_id: 1 }));
    tree.set(1, makeNode(1, { parent_id: 0, selected_child_id: 2 }));
    tree.set(2, makeNode(2, { parent_id: 1, selected_child_id: 3 }));
    tree.set(3, makeNode(3, { parent_id: 2 }));
    expect(getActiveLeafId(tree)).toBe(3);
  });

  it("throws on a selected_child_id cycle", () => {
    const tree = createTree();
    const a = makeNode(0, { selected_child_id: 1 });
    const b = makeNode(1, { parent_id: 0, selected_child_id: 0 });
    tree.set(0, a);
    tree.set(1, b);
    expect(() => getActiveLeafId(tree)).toThrow(/Cycle detected/);
  });

  it("accepts an explicit rootId override", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1], selected_child_id: 1 }));
    tree.set(1, makeNode(1, { parent_id: 0, selected_child_id: 2 }));
    tree.set(2, makeNode(2, { parent_id: 1 }));
    expect(getActiveLeafId(tree, 0)).toBe(2);
  });
});

describe("getActivePath", () => {
  it("returns [] for an empty tree", () => {
    expect(getActivePath(createTree())).toEqual([]);
  });

  it("returns [root] when root has no selected_child_id and no leafId is given", () => {
    const tree = createTree();
    tree.set(0, makeNode(0));
    expect(getActivePath(tree)).toHaveLength(1);
    expect(getActivePath(tree)[0].id).toBe(0);
  });

  it("returns [] when activeLeafId points to a node not in the tree", () => {
    const tree = createTree();
    tree.set(0, makeNode(0));
    expect(getActivePath(tree, 999)).toEqual([]);
  });

  it("walks leaf→root via parent_id and returns root→leaf order", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { selected_child_id: 1 }));
    tree.set(1, makeNode(1, { parent_id: 0, selected_child_id: 2 }));
    tree.set(2, makeNode(2, { parent_id: 1, selected_child_id: 3 }));
    tree.set(3, makeNode(3, { parent_id: 2 }));
    const path = getActivePath(tree);
    expect(path.map((n) => n.id)).toEqual([0, 1, 2, 3]);
  });

  it("honors an explicit activeLeafId (can view non-selected branch)", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { selected_child_id: 1 }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    tree.set(2, makeNode(2, { parent_id: 0 }));
    tree.set(3, makeNode(3, { parent_id: 1 }));
    const path = getActivePath(tree, 3);
    expect(path.map((n) => n.id)).toEqual([0, 1, 3]);
  });

  it("throws on a parent_id cycle", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1, 2] }));
    const a = makeNode(1, { parent_id: 2 });
    const b = makeNode(2, { parent_id: 1 });
    tree.set(1, a);
    tree.set(2, b);
    expect(() => getActivePath(tree, 1)).toThrow(/Cycle detected/);
  });
});

describe("getNextSiblingId / getPrevSiblingId", () => {
  function setupFamily(): ChatTree {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1, 2, 3] }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    tree.set(2, makeNode(2, { parent_id: 0 }));
    tree.set(3, makeNode(3, { parent_id: 0 }));
    return tree;
  }

  it("returns null for the root", () => {
    const tree = setupFamily();
    expect(getNextSiblingId(tree, 0)).toBeNull();
    expect(getPrevSiblingId(tree, 0)).toBeNull();
  });

  it("returns null for a node whose parent is missing", () => {
    const tree = createTree();
    tree.set(1, makeNode(1, { parent_id: 999 }));
    expect(getNextSiblingId(tree, 1)).toBeNull();
    expect(getPrevSiblingId(tree, 1)).toBeNull();
  });

  it("returns the next sibling for a first/middle child", () => {
    const tree = setupFamily();
    expect(getNextSiblingId(tree, 1)).toBe(2);
    expect(getNextSiblingId(tree, 2)).toBe(3);
  });

  it("returns the prev sibling for a middle/last child", () => {
    const tree = setupFamily();
    expect(getPrevSiblingId(tree, 3)).toBe(2);
    expect(getPrevSiblingId(tree, 2)).toBe(1);
  });

  it("returns null on the boundary (first child has no prev, last has no next)", () => {
    const tree = setupFamily();
    expect(getPrevSiblingId(tree, 1)).toBeNull();
    expect(getNextSiblingId(tree, 3)).toBeNull();
  });

  it("returns null when the node is missing from parent.children (corrupt)", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [] }));
    tree.set(5, makeNode(5, { parent_id: 0 }));
    expect(getNextSiblingId(tree, 5)).toBeNull();
    expect(getPrevSiblingId(tree, 5)).toBeNull();
  });
});

describe("getSiblings", () => {
  it("returns just the node for a root (no parent)", () => {
    const tree = createTree();
    const n = makeNode(0);
    tree.set(0, n);
    expect(getSiblings(tree, 0)).toEqual([n]);
  });

  it("returns just the node when the parent is missing", () => {
    const tree = createTree();
    const n = makeNode(1, { parent_id: 999 });
    tree.set(1, n);
    expect(getSiblings(tree, 1)).toEqual([n]);
  });

  it("returns all children of the parent in order, including the node itself", () => {
    const tree = createTree();
    const a = makeNode(0, { children: [1, 2, 3] });
    const b = makeNode(1, { parent_id: 0 });
    const c = makeNode(2, { parent_id: 0 });
    const d = makeNode(3, { parent_id: 0 });
    tree.set(0, a);
    tree.set(1, b);
    tree.set(2, c);
    tree.set(3, d);
    expect(getSiblings(tree, 2)).toEqual([b, c, d]);
  });

  it("skips child ids listed but not in the tree and warns", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1, 999, 2] }));
    const b = makeNode(1, { parent_id: 0 });
    const c = makeNode(2, { parent_id: 0 });
    tree.set(1, b);
    tree.set(2, c);
    expect(getSiblings(tree, 1)).toEqual([b, c]);
    expect(capture.warnings).toHaveLength(1);
    expect(capture.warnings[0]).toMatch(/999/);
  });
});

describe("addChild", () => {
  it("appends the node under the parent, sets parent_id, and auto-selects it", () => {
    const tree = createTree();
    const root = makeNode(0, { role: "system", content: "sys" });
    tree.set(0, root);

    const child = addChild(tree, 0, makeNode(1, { role: "user", content: "hi" }));

    expect(child.parent_id).toBe(0);
    expect(child.children).toEqual([]);
    expect(child.selected_child_id).toBeNull();
    expect(root.children).toEqual([1]);
    expect(root.selected_child_id).toBe(1);
    expect(tree.get(1)).toBe(child);
  });

  it("normalizes a non-array children field on the new node", () => {
    const tree = createTree();
    tree.set(0, makeNode(0));
    const dirty = { ...makeNode(1), children: "not-an-array" as unknown as number[] };
    const cleaned = addChild(tree, 0, dirty);
    expect(cleaned.children).toEqual([]);
  });

  it("resets a pre-existing selected_child_id on the new node", () => {
    const tree = createTree();
    tree.set(0, makeNode(0));
    const node = addChild(tree, 0, makeNode(1, { selected_child_id: 999 }));
    expect(node.selected_child_id).toBeNull();
  });

  it("throws when the parent does not exist", () => {
    const tree = createTree();
    expect(() => addChild(tree, 999, makeNode(1))).toThrow(/parent 999 not found/);
  });

  it("throws when the node id is already in the tree", () => {
    const tree = createTree();
    tree.set(0, makeNode(0));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    expect(() => addChild(tree, 0, makeNode(1))).toThrow(/node 1 already exists/);
  });
});

describe("addSibling", () => {
  it("inserts the node after nodeId in the parent children list", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1, 2] }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    tree.set(2, makeNode(2, { parent_id: 0 }));

    const sib = addSibling(tree, 1, makeNode(3, { content: "alt" }));

    expect(sib.parent_id).toBe(0);
    expect(sib.children).toEqual([]);
    expect(sib.selected_child_id).toBeNull();
    expect(tree.get(0)!.children).toEqual([1, 3, 2]);
  });

  it("does NOT change parent.selected_child_id (no auto-select)", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1], selected_child_id: 1 }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    addSibling(tree, 1, makeNode(2));
    expect(tree.get(0)!.selected_child_id).toBe(1);
  });

  it("appends to the end when nodeId exists in the tree but is missing from parent.children", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1] }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    tree.set(99, makeNode(99, { parent_id: 0 }));
    addSibling(tree, 99, makeNode(2, { parent_id: 0 }));
    expect(tree.get(0)!.children).toEqual([1, 2]);
  });

  it("throws when nodeId does not exist", () => {
    const tree = createTree();
    expect(() => addSibling(tree, 999, makeNode(1))).toThrow(/node 999 not found/);
  });

  it("throws when the new node id is already in the tree", () => {
    const tree = createTree();
    tree.set(0, makeNode(0));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    expect(() => addSibling(tree, 1, makeNode(1))).toThrow(/node 1 already exists/);
  });
});

describe("selectChild", () => {
  it("updates parent.selected_child_id", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1, 2] }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    tree.set(2, makeNode(2, { parent_id: 0 }));
    selectChild(tree, 0, 2);
    expect(tree.get(0)!.selected_child_id).toBe(2);
  });

  it("throws when the parent does not exist", () => {
    const tree = createTree();
    expect(() => selectChild(tree, 999, 1)).toThrow(/parent 999 not found/);
  });

  it("throws when childId is not a child of parent", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1] }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    expect(() => selectChild(tree, 0, 99)).toThrow(/99 is not a child of 0/);
  });
});

describe("deleteSubtree", () => {
  it("removes a leaf and updates the parent children list", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1, 2] }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    tree.set(2, makeNode(2, { parent_id: 0 }));
    deleteSubtree(tree, 1);
    expect(tree.has(1)).toBe(false);
    expect(tree.get(0)!.children).toEqual([2]);
  });

  it("re-points selected_child_id to the next sibling when deleting the selected leaf", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1, 2, 3], selected_child_id: 1 }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    tree.set(2, makeNode(2, { parent_id: 0 }));
    tree.set(3, makeNode(3, { parent_id: 0 }));
    deleteSubtree(tree, 1);
    expect(tree.get(0)!.selected_child_id).toBe(2);
  });

  it("falls back to the previous sibling when there is no next sibling", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1, 2], selected_child_id: 2 }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    tree.set(2, makeNode(2, { parent_id: 0 }));
    deleteSubtree(tree, 2);
    expect(tree.get(0)!.selected_child_id).toBe(1);
  });

  it("sets selected_child_id to null when deleting the only child", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1], selected_child_id: 1 }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    deleteSubtree(tree, 1);
    expect(tree.get(0)!.selected_child_id).toBeNull();
    expect(tree.get(0)!.children).toEqual([]);
  });

  it("leaves selected_child_id unchanged when the deleted node was not selected", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1, 2], selected_child_id: 2 }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    tree.set(2, makeNode(2, { parent_id: 0 }));
    deleteSubtree(tree, 1);
    expect(tree.get(0)!.selected_child_id).toBe(2);
  });

  it("recursively deletes all descendants of an internal node", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1, 2], selected_child_id: 1 }));
    tree.set(1, makeNode(1, { parent_id: 0, children: [3, 4] }));
    tree.set(2, makeNode(2, { parent_id: 0 }));
    tree.set(3, makeNode(3, { parent_id: 1, children: [5] }));
    tree.set(4, makeNode(4, { parent_id: 1 }));
    tree.set(5, makeNode(5, { parent_id: 3 }));

    deleteSubtree(tree, 1);

    expect(tree.has(1)).toBe(false);
    expect(tree.has(3)).toBe(false);
    expect(tree.has(4)).toBe(false);
    expect(tree.has(5)).toBe(false);
    expect(tree.get(0)!.children).toEqual([2]);
    expect(tree.get(0)!.selected_child_id).toBe(2);
  });

  it("removes a root with no parent_id update", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1] }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    deleteSubtree(tree, 0);
    expect(tree.has(0)).toBe(false);
    expect(tree.has(1)).toBe(false);
  });

  it("is a no-op for a missing node", () => {
    const tree = createTree();
    tree.set(0, makeNode(0));
    expect(() => deleteSubtree(tree, 999)).not.toThrow();
    expect(tree.size).toBe(1);
  });
});

describe("replaceNode", () => {
  it("swaps the node data at the same id", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { content: "old" }));
    const next = makeNode(0, { content: "new" });
    replaceNode(tree, next);
    expect(tree.get(0)).toBe(next);
    expect(tree.get(0)!.content).toBe("new");
  });

  it("throws when the node id is not in the tree", () => {
    const tree = createTree();
    expect(() => replaceNode(tree, makeNode(99))).toThrow(/node 99 not found/);
  });
});

describe("treeFromNodes", () => {
  it("builds a Map from a flat array", () => {
    const nodes = [makeNode(0), makeNode(1, { parent_id: 0 })];
    const tree = treeFromNodes(nodes);
    expect(tree).toBeInstanceOf(Map);
    expect(tree.size).toBe(2);
    expect(tree.get(1)!.parent_id).toBe(0);
  });

  it("clones the children array (mutating the source does not affect the tree)", () => {
    const src = makeNode(0, { children: [1, 2] });
    const c1 = makeNode(1, { parent_id: 0 });
    const c2 = makeNode(2, { parent_id: 0 });
    const tree = treeFromNodes([src, c1, c2]);
    src.children.push(99);
    expect(tree.get(0)!.children).toEqual([1, 2]);
  });

  it("treats a missing children field as an empty array", () => {
    const n = { id: 0, role: "user" as const, content: "x", parent_id: null } as ChatMessage;
    const tree = treeFromNodes([n]);
    expect(tree.get(0)!.children).toEqual([]);
  });

  it("returns an empty Map for an empty input", () => {
    expect(treeFromNodes([]).size).toBe(0);
  });
});

describe("treeToNodes", () => {
  it("returns all values in insertion order", () => {
    const tree = createTree();
    tree.set(0, makeNode(0));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    tree.set(2, makeNode(2, { parent_id: 1 }));
    expect(treeToNodes(tree).map((n) => n.id)).toEqual([0, 1, 2]);
  });

  it("returns [] for an empty tree", () => {
    expect(treeToNodes(createTree())).toEqual([]);
  });
});

describe("treeToActivePath", () => {
  it("returns [] for an empty tree", () => {
    expect(treeToActivePath(createTree())).toEqual([]);
  });

  it("returns only the selected branch root→leaf, omitting siblings", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { selected_child_id: 1 }));
    tree.set(1, makeNode(1, { parent_id: 0, selected_child_id: 3 }));
    tree.set(2, makeNode(2, { parent_id: 0 }));
    tree.set(3, makeNode(3, { parent_id: 1, selected_child_id: 4 }));
    tree.set(4, makeNode(4, { parent_id: 3 }));
    expect(treeToActivePath(tree).map((n) => n.id)).toEqual([0, 1, 3, 4]);
  });
});

describe("validateTree", () => {
  it("passes for a simple valid tree", () => {
    const tree = treeFromNodes([
      makeNode(0, { children: [1] }),
      makeNode(1, { parent_id: 0, children: [2] }),
      makeNode(2, { parent_id: 1 }),
    ]);
    const result = validateTree(tree);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("errors when there is no root", () => {
    const tree = createTree();
    tree.set(1, makeNode(1, { parent_id: 0 }));
    tree.set(2, makeNode(2, { parent_id: 1 }));
    const result = validateTree(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /no root/i.test(e))).toBe(true);
  });

  it("errors when there are multiple roots", () => {
    const tree = createTree();
    tree.set(0, makeNode(0));
    tree.set(1, makeNode(1));
    const result = validateTree(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /multiple root/i.test(e))).toBe(true);
  });

  it("errors when children is not an array", () => {
    const tree = createTree();
    tree.set(0, { ...makeNode(0), children: "oops" as unknown as number[] });
    const result = validateTree(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /children is not an array/.test(e))).toBe(true);
  });

  it("errors on duplicate child ids in a children list", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1, 1, 2] }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    tree.set(2, makeNode(2, { parent_id: 0 }));
    const result = validateTree(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /duplicate child 1/.test(e))).toBe(true);
  });

  it("errors when a child id is listed but missing from the tree", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1, 99] }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    const result = validateTree(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /child 99 not found/.test(e))).toBe(true);
  });

  it("errors when a child parent_id does not match its parent", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1] }));
    tree.set(1, makeNode(1, { parent_id: 999 }));
    const result = validateTree(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /parent_id 999, expected 0/.test(e))).toBe(true);
  });

  it("errors when selected_child_id is not in the children list", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1], selected_child_id: 999 }));
    tree.set(1, makeNode(1, { parent_id: 0 }));
    const result = validateTree(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /selected_child_id 999 not in children/.test(e))).toBe(true);
  });

  it("errors on a cycle in the children graph", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1], selected_child_id: 1 }));
    tree.set(1, makeNode(1, { parent_id: 0, children: [0] }));
    const result = validateTree(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /cycle/i.test(e))).toBe(true);
  });

  it("warns (but is still valid) for an unreachable node", () => {
    const tree = createTree();
    tree.set(0, makeNode(0));
    tree.set(1, makeNode(1, { parent_id: 999 }));
    const result = validateTree(tree);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => /unreachable/.test(w) && w.includes("1"))).toBe(true);
  });

  it("passes for a valid branching tree", () => {
    const tree = createTree();
    tree.set(0, makeNode(0, { children: [1, 2], selected_child_id: 2 }));
    tree.set(1, makeNode(1, { parent_id: 0, children: [3] }));
    tree.set(2, makeNode(2, { parent_id: 0, children: [4], selected_child_id: 4 }));
    tree.set(3, makeNode(3, { parent_id: 1 }));
    tree.set(4, makeNode(4, { parent_id: 2 }));
    const result = validateTree(tree);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe("integration: swipe / regenerate workflow", () => {
  function freshTree(): ChatTree {
    const tree = createTree();
    tree.set(0, makeRoleNode(0, "system", "sys prompt"));
    return tree;
  }

  it("supports the full SillyTavern swipe flow and stays valid at every step", () => {
    const tree = freshTree();
    expect(validateTree(tree).valid).toBe(true);

    addChild(tree, 0, makeRoleNode(1, "user", "hello"));
    expect(validateTree(tree).valid).toBe(true);
    expect(getActivePath(tree).map((n) => n.role)).toEqual(["system", "user"]);

    addChild(tree, 1, makeRoleNode(2, "assistant", "reply A"));
    expect(validateTree(tree).valid).toBe(true);
    expect(getActivePath(tree).map((n) => n.id)).toEqual([0, 1, 2]);

    const swipeB = addSibling(tree, 2, makeRoleNode(3, "assistant", "reply B (swipe)"));
    expect(validateTree(tree).valid).toBe(true);
    expect(tree.get(1)!.children).toEqual([2, 3]);
    expect(tree.get(1)!.selected_child_id).toBe(2);
    expect(getActivePath(tree).map((n) => n.id)).toEqual([0, 1, 2]);

    selectChild(tree, 1, 3);
    expect(getActivePath(tree).map((n) => n.id)).toEqual([0, 1, 3]);
    expect(validateTree(tree).valid).toBe(true);

    addChild(tree, swipeB.id, makeRoleNode(4, "user", "follow-up"));
    expect(getActivePath(tree).map((n) => n.id)).toEqual([0, 1, 3, 4]);
    expect(validateTree(tree).valid).toBe(true);

    expect(treeToActivePath(tree).map((n) => n.id)).toEqual([0, 1, 3, 4]);

    deleteSubtree(tree, 2);
    expect(tree.has(2)).toBe(false);
    expect(getActivePath(tree).map((n) => n.id)).toEqual([0, 1, 3, 4]);
    expect(validateTree(tree).valid).toBe(true);

    const roundTrip = treeFromNodes(treeToNodes(tree));
    const activeBefore = getActivePath(tree).map((n) => n.id);
    const activeAfter = getActivePath(roundTrip).map((n) => n.id);
    expect(activeAfter).toEqual(activeBefore);
    expect(validateTree(roundTrip).valid).toBe(true);
  });
});
