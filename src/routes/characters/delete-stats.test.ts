import { describe, expect, it } from "vitest";
import { characterDeleteDescription } from "./delete-stats";

describe("characterDeleteDescription", () => {
  it("renders the exact full string for plural counts", () => {
    expect(characterDeleteDescription("Zephyr", 2, 5)).toBe(
      "This permanently deletes “Zephyr”, 2 chats, and 5 messages. This cannot be undone.",
    );
  });

  it("singulars the chat count", () => {
    expect(characterDeleteDescription("Zephyr", 1, 5)).toContain("1 chat");
  });

  it("singulars the message count", () => {
    expect(characterDeleteDescription("Zephyr", 2, 1)).toContain("1 message");
  });

  it("renders 0 counts as plural", () => {
    const s = characterDeleteDescription("Zephyr", 0, 0);
    expect(s).toContain("0 chats");
    expect(s).toContain("0 messages");
  });

  it("embeds the character name verbatim", () => {
    expect(characterDeleteDescription('He said "hi"', 1, 1)).toContain('He said "hi"');
  });
});
