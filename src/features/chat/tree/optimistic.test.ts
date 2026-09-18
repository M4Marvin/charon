import { describe, expect, it } from "vitest";
import type { ChatMessageRow } from "@/db/schema";
import { applyDeleteOptimistic, applySwipeOptimistic } from "./optimistic";

function row(partial: Partial<ChatMessageRow> & { localId: number }): ChatMessageRow {
  return {
    chatId: "chat-1",
    parentLocalId: null,
    children: [],
    selectedChildLocalId: null,
    role: "assistant",
    content: "",
    extra: null,
    ...partial,
  };
}

// root(0) -> children [1, 2], selects 1; leaf 1 and 2 have no children.
function siblingRows(): ChatMessageRow[] {
  return [
    row({ localId: 0, role: "system", children: [1, 2], selectedChildLocalId: 1 }),
    row({ localId: 1, parentLocalId: 0, content: "first" }),
    row({ localId: 2, parentLocalId: 0, content: "second" }),
  ];
}

describe("applySwipeOptimistic", () => {
  it("flips parent selection to the next sibling", () => {
    const next = applySwipeOptimistic(siblingRows(), 1, "next");
    expect(next?.find((r) => r.localId === 0)?.selectedChildLocalId).toBe(2);
  });

  it("flips parent selection to the previous sibling", () => {
    const rows = siblingRows();
    const selected = rows.map((r) => (r.localId === 0 ? { ...r, selectedChildLocalId: 2 } : r));
    const next = applySwipeOptimistic(selected, 2, "prev");
    expect(next?.find((r) => r.localId === 0)?.selectedChildLocalId).toBe(1);
  });

  it("returns null at the boundaries (server no-op)", () => {
    expect(applySwipeOptimistic(siblingRows(), 1, "prev")).toBeNull();
    expect(applySwipeOptimistic(siblingRows(), 2, "next")).toBeNull();
  });

  it("returns null for the hidden root and unknown nodes", () => {
    expect(applySwipeOptimistic(siblingRows(), 0, "next")).toBeNull();
    expect(applySwipeOptimistic(siblingRows(), 99, "next")).toBeNull();
  });

  it("does not mutate the input rows", () => {
    const rows = siblingRows();
    applySwipeOptimistic(rows, 1, "next");
    expect(rows.find((r) => r.localId === 0)?.selectedChildLocalId).toBe(1);
  });
});

describe("applyDeleteOptimistic", () => {
  // root(0) -> [1, 2] selects 1; 1 -> [3] selects 3.
  function branchRows(): ChatMessageRow[] {
    return [
      row({ localId: 0, role: "system", children: [1, 2], selectedChildLocalId: 1 }),
      row({ localId: 1, parentLocalId: 0, children: [3], selectedChildLocalId: 3, content: "a" }),
      row({ localId: 2, parentLocalId: 0, content: "b" }),
      row({ localId: 3, parentLocalId: 1, content: "a-child" }),
    ];
  }

  it("removes the target and reselects the next sibling", () => {
    const next = applyDeleteOptimistic(branchRows(), 1);
    expect(next?.map((r) => r.localId).sort()).toEqual([0, 2]);
    const root = next?.find((r) => r.localId === 0);
    expect(root?.children).toEqual([2]);
    expect(root?.selectedChildLocalId).toBe(2);
  });

  it("removes the whole subtree when deleting an ancestor", () => {
    const next = applyDeleteOptimistic(branchRows(), 1);
    expect(next?.some((r) => r.localId === 3)).toBe(false);
  });

  it("reselects the previous sibling when deleting the last child", () => {
    const rows = branchRows().map((r) => (r.localId === 0 ? { ...r, selectedChildLocalId: 2 } : r));
    const next = applyDeleteOptimistic(rows, 2);
    const root = next?.find((r) => r.localId === 0);
    expect(root?.children).toEqual([1]);
    expect(root?.selectedChildLocalId).toBe(1);
  });

  it("keeps selection when deleting a non-selected sibling", () => {
    const next = applyDeleteOptimistic(branchRows(), 2);
    const root = next?.find((r) => r.localId === 0);
    expect(root?.children).toEqual([1]);
    expect(root?.selectedChildLocalId).toBe(1);
  });

  it("returns null for the hidden root and unknown nodes", () => {
    expect(applyDeleteOptimistic(branchRows(), 0)).toBeNull();
    expect(applyDeleteOptimistic(branchRows(), 99)).toBeNull();
  });

  it("does not mutate the input rows", () => {
    const rows = branchRows();
    applyDeleteOptimistic(rows, 1);
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.localId === 0)?.children).toEqual([1, 2]);
  });
});
