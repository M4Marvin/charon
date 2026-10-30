import { describe, expect, it } from "vitest";
import { characterDeleteDescription } from "./delete-stats";

describe("characterDeleteDescription", () => {
  it("renders the exact full string for plural counts", () => {
    expect(characterDeleteDescription(2, 5)).toBe(
      "This permanently deletes this character, 2 chats, and 5 messages. This cannot be undone.",
    );
  });

  it("singulars the chat count", () => {
    expect(characterDeleteDescription(1, 5)).toContain("1 chat");
  });

  it("singulars the message count", () => {
    expect(characterDeleteDescription(2, 1)).toContain("1 message");
  });

  it("renders 0 counts as plural", () => {
    const s = characterDeleteDescription(0, 0);
    expect(s).toContain("0 chats");
    expect(s).toContain("0 messages");
  });

  it("omits the message count when the library does not know it", () => {
    expect(characterDeleteDescription(1)).toBe(
      "This permanently deletes this character and its 1 chat, including every message. This cannot be undone.",
    );
  });
});
