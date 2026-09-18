import { describe, expect, it } from "vitest";
import type { ActivePathEntry } from "@/features/chat/tree/types";
import { isPendingVisible } from "./pending";

function entry(localId: number): ActivePathEntry {
  return {
    message: {
      localId,
      parentLocalId: 0,
      children: [],
      selectedChildLocalId: null,
      role: "assistant",
      content: "hi",
    },
    siblingIndex: 0,
    siblingTotal: 1,
  };
}

describe("isPendingVisible", () => {
  it("is hidden without pending state", () => {
    expect(isPendingVisible(null, "c1", [entry(1)], null)).toBe(false);
  });

  it("is hidden for another chat's pending state", () => {
    expect(isPendingVisible({ chatId: "c2", content: "hello" }, "c1", [entry(1)], null)).toBe(
      false,
    );
  });

  it("is visible while prepare is in flight (no placeholder yet)", () => {
    expect(isPendingVisible({ chatId: "c1", content: "hello" }, "c1", [entry(1)], null)).toBe(true);
  });

  it("stays visible after prepare resolves but before refetch lands", () => {
    expect(isPendingVisible({ chatId: "c1", content: "hello" }, "c1", [entry(1)], 3)).toBe(true);
  });

  it("hides once the server placeholder row arrives", () => {
    expect(
      isPendingVisible({ chatId: "c1", content: "hello" }, "c1", [entry(1), entry(3)], 3),
    ).toBe(false);
  });

  it("covers dots-only pending (continue/regenerate, null content)", () => {
    expect(isPendingVisible({ chatId: "c1", content: null }, "c1", [entry(1)], null)).toBe(true);
  });
});
