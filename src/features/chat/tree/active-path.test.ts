import { describe, it, expect } from "vitest";
import type { ChatMessage, ChatTree } from "@/lib/st-core/shared/types";
import { computeActivePathFromMessages, computeActivePath, getPathToNode } from "./active-path";

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

describe("computeActivePathFromMessages", () => {
  it("returns empty array for empty messages", () => {
    expect(computeActivePathFromMessages([])).toEqual([]);
  });

  it("returns one entry for root + single greeting", () => {
    const messages: ChatMessage[] = [
      makeMsg({ localId: 0, role: "system", content: "", children: [1], selectedChildLocalId: 1 }),
      makeMsg({ localId: 1, parentLocalId: 0, role: "assistant", content: "Hello!" }),
    ];
    const path = computeActivePathFromMessages(messages);
    expect(path).toHaveLength(1);
    expect(path[0]!.message.localId).toBe(1);
    expect(path[0]!.message.content).toBe("Hello!");
    expect(path[0]!.siblingIndex).toBe(0);
    expect(path[0]!.siblingTotal).toBe(1);
  });

  it("filters out system root", () => {
    const messages: ChatMessage[] = [
      makeMsg({ localId: 0, role: "system", content: "", children: [1], selectedChildLocalId: 1 }),
      makeMsg({ localId: 1, parentLocalId: 0, role: "assistant", content: "Hi" }),
      makeMsg({
        localId: 2,
        parentLocalId: 1,
        children: [],
        selectedChildLocalId: null,
        role: "user",
        content: "Hey",
      }),
    ];
    // Ensure path goes 1 → 2 by setting selectedChildLocalId on msg 1
    const msg = messages[0]!;
    msg.children = [1];
    msg.selectedChildLocalId = 1;
    const msg1 = messages[1]!;
    msg1.children = [2];
    msg1.selectedChildLocalId = 2;

    const path = computeActivePathFromMessages(messages);
    expect(path).toHaveLength(2);
    expect(path[0]!.message.localId).toBe(1);
    expect(path[1]!.message.localId).toBe(2);
  });

  it("computes correct sibling index and total for multi-greeting tree", () => {
    const root = makeMsg({
      localId: 0,
      role: "system",
      content: "",
      children: [1, 2, 3],
      selectedChildLocalId: 2,
    });
    const g1 = makeMsg({ localId: 1, parentLocalId: 0, role: "assistant", content: "Hi" });
    const g2 = makeMsg({ localId: 2, parentLocalId: 0, role: "assistant", content: "Hey" });
    const g3 = makeMsg({ localId: 3, parentLocalId: 0, role: "assistant", content: "Yo" });

    const path = computeActivePathFromMessages([root, g1, g2, g3]);
    expect(path).toHaveLength(1);
    expect(path[0]!.message.localId).toBe(2);
    expect(path[0]!.siblingIndex).toBe(1);
    expect(path[0]!.siblingTotal).toBe(3);
  });

  it("returns empty array for system-root-only tree", () => {
    const messages: ChatMessage[] = [
      makeMsg({
        localId: 0,
        role: "system",
        content: "",
        children: [],
        selectedChildLocalId: null,
      }),
    ];
    // Need to add a greeting to make it valid
    const root = messages[0]!;
    root.children = [1, 2];
    root.selectedChildLocalId = 1;
    messages.push(makeMsg({ localId: 1, parentLocalId: 0, role: "assistant", content: "Hi" }));
    const path = computeActivePathFromMessages(messages);
    expect(path).toHaveLength(1);
  });
});

describe("computeActivePath (from tree)", () => {
  it("uses tree directly", () => {
    const tree: ChatTree = new Map();
    const root = makeMsg({
      localId: 0,
      role: "system",
      content: "",
      children: [1],
      selectedChildLocalId: 1,
    });
    tree.set(0, root);
    const msg = makeMsg({ localId: 1, parentLocalId: 0, role: "assistant", content: "Hello!" });
    tree.set(1, msg);

    const path = computeActivePath(tree);
    expect(path).toHaveLength(1);
    expect(path[0]!.message.localId).toBe(1);
  });
});

describe("getPathToNode", () => {
  it("walks from leaf to root", () => {
    const tree: ChatTree = new Map();
    tree.set(0, makeMsg({ localId: 0, role: "system", content: "", parentLocalId: null }));
    tree.set(1, makeMsg({ localId: 1, parentLocalId: 0, role: "assistant" }));
    tree.set(2, makeMsg({ localId: 2, parentLocalId: 1, role: "user" }));
    tree.set(3, makeMsg({ localId: 3, parentLocalId: 2, role: "assistant" }));

    const path = getPathToNode(tree, 3);
    expect(path).toHaveLength(4);
    expect(path[0]!.localId).toBe(0);
    expect(path[1]!.localId).toBe(1);
    expect(path[2]!.localId).toBe(2);
    expect(path[3]!.localId).toBe(3);
  });

  it("returns single node for root", () => {
    const tree: ChatTree = new Map();
    tree.set(0, makeMsg({ localId: 0, role: "system", content: "", parentLocalId: null }));
    const path = getPathToNode(tree, 0);
    expect(path).toHaveLength(1);
    expect(path[0]!.localId).toBe(0);
  });

  it("returns empty array for missing node", () => {
    const tree: ChatTree = new Map();
    tree.set(0, makeMsg({ localId: 0, role: "system" }));
    const path = getPathToNode(tree, 999);
    expect(path).toEqual([]);
  });
});
