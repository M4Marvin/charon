import { describe, expect, it } from "vitest";
import type { ActivePathEntry } from "@/features/chat/tree/types";
import {
  activeTickIndex,
  indexFromPointer,
  nearestIndex,
  previewText,
  toTicks,
} from "./message-overview";

function entry(
  localId: number,
  role: "user" | "assistant" | "system",
  content: string,
): ActivePathEntry {
  return {
    message: {
      localId,
      parentLocalId: 0,
      children: [],
      selectedChildLocalId: null,
      role,
      content,
    },
    siblingIndex: 0,
    siblingTotal: 1,
  };
}

describe("previewText", () => {
  it("collapses whitespace", () => {
    expect(previewText("hello\n\n  world\t!")).toBe("hello world !");
  });

  it("truncates with an ellipsis at the limit", () => {
    const out = previewText("a".repeat(120), 10);
    expect(out).toHaveLength(10);
    expect(out.endsWith("…")).toBe(true);
  });

  it("leaves short content untouched", () => {
    expect(previewText("hi")).toBe("hi");
  });
});

describe("toTicks", () => {
  it("maps entries and drops system rows", () => {
    const ticks = toTicks([
      entry(0, "system", "hidden"),
      entry(1, "assistant", "greeting"),
      entry(2, "user", "hello there"),
    ]);
    expect(ticks).toEqual([
      { id: "1", role: "assistant", preview: "greeting" },
      { id: "2", role: "user", preview: "hello there" },
    ]);
  });
});

describe("nearestIndex", () => {
  it("rounds to the closest of `count` slots", () => {
    expect(nearestIndex(0, 5)).toBe(0);
    expect(nearestIndex(1, 5)).toBe(4);
    expect(nearestIndex(0.5, 5)).toBe(2);
    expect(nearestIndex(0.51, 5)).toBe(2);
  });

  it("clamps out-of-range ratios", () => {
    expect(nearestIndex(-3, 5)).toBe(0);
    expect(nearestIndex(9, 5)).toBe(4);
  });

  it("returns 0 for a single slot", () => {
    expect(nearestIndex(0.8, 1)).toBe(0);
  });
});

describe("indexFromPointer", () => {
  it("maps clientY within the track to an index", () => {
    expect(indexFromPointer(100, 100, 200, 3)).toBe(0);
    expect(indexFromPointer(200, 100, 200, 3)).toBe(1);
    expect(indexFromPointer(300, 100, 200, 3)).toBe(2);
  });

  it("returns 0 when the track has no measured height", () => {
    expect(indexFromPointer(42, 0, 0, 4)).toBe(0);
  });
});

describe("activeTickIndex", () => {
  const ticks = toTicks([
    entry(1, "assistant", "a"),
    entry(2, "user", "b"),
    entry(3, "assistant", "c"),
  ]);

  it("prefers the scroller anchor", () => {
    expect(activeTickIndex(ticks, "3", ["2"])).toBe(2);
  });

  it("falls back to the first visible message", () => {
    expect(activeTickIndex(ticks, null, ["2", "3"])).toBe(1);
  });

  it("defaults to the first tick", () => {
    expect(activeTickIndex(ticks, null, [])).toBe(0);
  });

  it("handles no ticks", () => {
    expect(activeTickIndex([], "3", ["2"])).toBe(0);
  });
});
