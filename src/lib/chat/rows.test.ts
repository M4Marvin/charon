import { describe, expect, it } from "vitest";
import { rowToMessage, messageToInsert } from "./rows";
import type { ChatMessageRow } from "@/db/schema";
import type { ChatMessage } from "@/lib/st-core/shared/types";

function makeRow(overrides: Partial<ChatMessageRow> = {}): ChatMessageRow {
  return {
    chatId: "chat-1",
    localId: 5,
    parentLocalId: 1,
    children: [6, 7],
    selectedChildLocalId: 6,
    role: "assistant",
    content: "Hello",
    extra: { key: "value" },
    ...overrides,
  };
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    localId: 5,
    parentLocalId: 1,
    children: [6, 7],
    selectedChildLocalId: 6,
    role: "assistant",
    content: "Hello",
    extra: { key: "value" },
    ...overrides,
  };
}

describe("rowToMessage", () => {
  it("drops chatId from the row", () => {
    const row = makeRow({ chatId: "chat-abc" });
    const msg = rowToMessage(row);
    expect(msg).not.toHaveProperty("chatId");
  });

  it("preserves non-null values", () => {
    const msg = rowToMessage(makeRow());
    expect(msg.localId).toBe(5);
    expect(msg.parentLocalId).toBe(1);
    expect(msg.children).toEqual([6, 7]);
    expect(msg.selectedChildLocalId).toBe(6);
    expect(msg.role).toBe("assistant");
    expect(msg.content).toBe("Hello");
    expect(msg.extra).toEqual({ key: "value" });
  });

  it("converts null extra to undefined", () => {
    const row = makeRow({ extra: null });
    const msg = rowToMessage(row);
    expect(msg.extra).toBeUndefined();
  });

  it("defaults children to [] when null", () => {
    const row = makeRow({ children: null as unknown as number[] });
    const msg = rowToMessage(row);
    expect(msg.children).toEqual([]);
  });

  it("returns message with expected type structure", () => {
    const msg = rowToMessage(makeRow());
    expect(typeof msg.localId).toBe("number");
    expect(msg.parentLocalId === null || typeof msg.parentLocalId === "number").toBe(true);
    expect(Array.isArray(msg.children)).toBe(true);
    expect(msg.selectedChildLocalId === null || typeof msg.selectedChildLocalId === "number").toBe(true);
    expect(["user", "assistant", "system"]).toContain(msg.role);
    expect(typeof msg.content).toBe("string");
  });
});

describe("messageToInsert", () => {
  it("returns a row with chatId and message fields", () => {
    const msg = makeMessage();
    const row = messageToInsert("chat-1", msg);
    expect(row.chatId).toBe("chat-1");
    expect(row.localId).toBe(5);
    expect(row.role).toBe("assistant");
    expect(row.content).toBe("Hello");
    expect(row.extra).toEqual({ key: "value" });
  });

  it("converts undefined extra to null", () => {
    const msg = makeMessage({ extra: undefined });
    const row = messageToInsert("chat-1", msg);
    expect(row.extra).toBeNull();
  });
});
