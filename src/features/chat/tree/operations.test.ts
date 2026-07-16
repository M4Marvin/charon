import { describe, it, expect } from "vitest";
import type { ChatMessage, ChatTree } from "@/lib/st-core/shared/types";
import {
  appendChild,
  appendToActiveLeaf,
  selectSibling,
  createSiblingAndSelect,
  removeBranch,
  editContent,
} from "./operations";

function makeMsg(overrides: Partial<ChatMessage> & { localId: number }): ChatMessage {
  return {
    parentLocalId: null,
    children: [],
    selectedChildLocalId: null,
    role: "assistant",
    content: "",
    ...overrides,
  };
}

function setupTree(): ChatTree {
  const tree: ChatTree = new Map();
  const root: ChatMessage = {
    localId: 0,
    parentLocalId: null,
    children: [1, 2],
    selectedChildLocalId: 1,
    role: "system",
    content: "",
  };
  const g1: ChatMessage = {
    localId: 1,
    parentLocalId: 0,
    children: [],
    selectedChildLocalId: null,
    role: "assistant",
    content: "Greeting 1",
  };
  const g2: ChatMessage = {
    localId: 2,
    parentLocalId: 0,
    children: [],
    selectedChildLocalId: null,
    role: "assistant",
    content: "Greeting 2",
  };
  tree.set(0, root);
  tree.set(1, g1);
  tree.set(2, g2);
  return tree;
}

describe("appendChild", () => {
  it("adds a child to a parent and sets selectedChildLocalId", () => {
    const tree = setupTree();
    const child = appendChild(tree, 1, {
      role: "user",
      content: "Hello!",
    });
    expect(child.localId).toBe(3); // getNextId after 0,1,2
    expect(child.role).toBe("user");
    expect(child.content).toBe("Hello!");
    expect(tree.get(1)!.children).toEqual([3]);
    expect(tree.get(1)!.selectedChildLocalId).toBe(3);
  });

  it("assigns incrementing ids on subsequent calls", () => {
    const tree = setupTree();
    const c1 = appendChild(tree, 1, { role: "user", content: "A" });
    const c2 = appendChild(tree, 1, { role: "user", content: "B" });
    expect(c1.localId).toBe(3);
    expect(c2.localId).toBe(4);
  });

  it("preserves extra on the new node", () => {
    const tree = setupTree();
    const child = appendChild(tree, 1, {
      role: "assistant",
      content: "",
      extra: { isStreaming: true },
    });
    expect(child.extra).toEqual({ isStreaming: true });
  });

  it("throws when parent does not exist", () => {
    const tree = setupTree();
    expect(() => appendChild(tree, 999, { role: "user", content: "x" })).toThrow(
      "parent 999 not found",
    );
  });
});

describe("appendToActiveLeaf", () => {
  it("appends to the deepest selected leaf", () => {
    const tree = setupTree();
    // Active leaf is 1 (root.selectedChildLocalId = 1)
    const msg = appendToActiveLeaf(tree, {
      role: "user",
      content: "Hey",
    });
    expect(msg.localId).toBe(3);
    expect(tree.get(1)!.children).toEqual([3]);
    expect(tree.get(1)!.selectedChildLocalId).toBe(3);
  });

  it("follows nested selection chain", () => {
    const tree = setupTree();
    // Add a chain: 1 → 3 → 4 (active leaf = 4)
    const g1 = tree.get(1)!;
    g1.children = [3];
    g1.selectedChildLocalId = 3;
    tree.set(
      3,
      makeMsg({
        localId: 3,
        parentLocalId: 1,
        role: "user",
        content: "Hi",
        children: [4],
        selectedChildLocalId: 4,
      }),
    );
    tree.set(4, makeMsg({ localId: 4, parentLocalId: 3, role: "assistant", content: "Hey back" }));

    const msg = appendToActiveLeaf(tree, {
      role: "user",
      content: "New msg",
    });
    expect(msg.localId).toBe(5);
    expect(tree.get(4)!.children).toEqual([5]);
  });

  it("throws on empty tree", () => {
    expect(() => appendToActiveLeaf(new Map(), { role: "user", content: "x" })).toThrow(
      "No active message",
    );
  });
});

describe("selectSibling", () => {
  it("selects the next sibling", () => {
    const tree = setupTree(); // root.children = [1,2], selected = 1
    const selected = selectSibling(tree, 1, "next");
    expect(selected).not.toBeNull();
    expect(selected!.localId).toBe(2);
    expect(tree.get(0)!.selectedChildLocalId).toBe(2);
  });

  it("selects the previous sibling", () => {
    const tree = setupTree();
    // Re-select root to point to greeting 2
    tree.get(0)!.selectedChildLocalId = 2;
    const selected = selectSibling(tree, 2, "prev");
    expect(selected!.localId).toBe(1);
    expect(tree.get(0)!.selectedChildLocalId).toBe(1);
  });

  it("returns null when no next sibling exists", () => {
    const tree = setupTree();
    tree.get(0)!.selectedChildLocalId = 2;
    const selected = selectSibling(tree, 2, "next");
    expect(selected).toBeNull();
  });

  it("returns null when no previous sibling exists", () => {
    const tree = setupTree();
    const selected = selectSibling(tree, 1, "prev");
    expect(selected).toBeNull();
  });

  it("throws on localId 0", () => {
    const tree = setupTree();
    expect(() => selectSibling(tree, 0, "next")).toThrow("hidden root");
  });
});

describe("createSiblingAndSelect", () => {
  it("creates a sibling after the target and selects it", () => {
    const tree = setupTree(); // root.children = [1,2], selected = 1
    const created = createSiblingAndSelect(tree, 1, {
      role: "assistant",
      content: "New greeting",
    });
    expect(created.localId).toBe(3);
    expect(tree.get(0)!.children).toEqual([1, 3, 2]); // inserted after 1
    expect(tree.get(0)!.selectedChildLocalId).toBe(3);
  });

  it("throws when target has no parent", () => {
    const tree = setupTree();
    tree.set(999, makeMsg({ localId: 999, parentLocalId: null }));
    expect(() =>
      createSiblingAndSelect(tree, 999, {
        role: "assistant",
        content: "x",
      }),
    ).toThrow("Cannot create sibling of root");
  });

  it("throws when target does not exist", () => {
    const tree = setupTree();
    expect(() =>
      createSiblingAndSelect(tree, 999, {
        role: "assistant",
        content: "x",
      }),
    ).toThrow("Node 999 not found");
  });
});

describe("removeBranch", () => {
  it("deletes a leaf node and returns its id", () => {
    const tree = setupTree(); // root.children = [1,2], selected = 1
    const ids = removeBranch(tree, 1);
    expect(ids).toEqual([1]);
    expect(tree.get(1)).toBeUndefined();
    expect(tree.get(0)!.children).toEqual([2]);
    // Selection should auto-re-point to next sibling (2)
    expect(tree.get(0)!.selectedChildLocalId).toBe(2);
  });

  it("deletes a subtree with descendants", () => {
    const tree = setupTree();
    // Build: 1 → 3 → 4
    tree.get(1)!.children = [3];
    tree.get(1)!.selectedChildLocalId = 3;
    tree.set(3, makeMsg({ localId: 3, parentLocalId: 1, role: "user", content: "Hi" }));
    tree.get(3)!.children = [4];
    tree.get(3)!.selectedChildLocalId = 4;
    tree.set(4, makeMsg({ localId: 4, parentLocalId: 3, role: "assistant", content: "Hey" }));

    const ids = removeBranch(tree, 3);
    expect(ids).toEqual([3, 4]);
    expect(tree.get(3)).toBeUndefined();
    expect(tree.get(4)).toBeUndefined();
    expect(tree.get(1)!.children).toEqual([]);
    expect(tree.get(1)!.selectedChildLocalId).toBeNull();
  });

  it("throws on localId 0", () => {
    expect(() => removeBranch(new Map(), 0)).toThrow("hidden root");
  });

  it("throws on root-like node (no parent)", () => {
    const tree: ChatTree = new Map();
    tree.set(1, makeMsg({ localId: 1, parentLocalId: null }));
    expect(() => removeBranch(tree, 1)).toThrow("delete the root message");
  });
});

describe("editContent", () => {
  it("updates content without changing tree structure", () => {
    const tree = setupTree();
    editContent(tree, 1, "Edited greeting");
    expect(tree.get(1)!.content).toBe("Edited greeting");
    expect(tree.get(1)!.localId).toBe(1);
    expect(tree.get(1)!.parentLocalId).toBe(0);
    expect(tree.get(1)!.children).toEqual([]);
  });

  it("throws on localId 0", () => {
    expect(() => editContent(new Map(), 0, "x")).toThrow("hidden root");
  });

  it("throws on missing node", () => {
    expect(() => editContent(new Map(), 999, "x")).toThrow("Node 999 not found");
  });
});
