import { describe, expect, it } from "vitest";
import type { ChatMessageRow } from "@/db/schema";
import { applySwipeOptimistic } from "./optimistic";

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
