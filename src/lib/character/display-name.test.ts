import { describe, expect, it } from "vitest";

import { deriveDisplayName } from "@/lib/character/display-name";
import type { CharacterDataV2 } from "@/lib/st-core/character";

function makeData(overrides: Partial<CharacterDataV2> = {}): CharacterDataV2 {
  return {
    name: "Test",
    description: "",
    personality: "",
    scenario: "",
    first_mes: "",
    mes_example: "",
    creator_notes: "",
    system_prompt: "",
    post_history_instructions: "",
    alternate_greetings: [],
    tags: [],
    creator: "",
    character_version: "",
    extensions: {},
    ...overrides,
  };
}

describe("deriveDisplayName", () => {
  it("humanizes the last segment of a source slug", () => {
    const data = makeData({
      extensions: { source: { full_path: "Anonymous/example-character-656d8b705cfb" } },
    });

    expect(deriveDisplayName(data)).toBe("Example Character");
  });

  it("strips the trailing hex ObjectId suffix from the slug", () => {
    const data = makeData({
      extensions: {
        source: { full_path: "Author/a-longer-example-title-048d5cbab78f" },
      },
    });

    expect(deriveDisplayName(data)).toBe("A Longer Example Title");
  });

  it("falls back to data.name when source metadata is missing", () => {
    const data = makeData({ extensions: {} });

    expect(deriveDisplayName(data)).toBe("Test");
  });

  it("falls back to data.name when full_path is missing or empty", () => {
    const missing = makeData({ extensions: { source: {} } });
    const empty = makeData({ extensions: { source: { full_path: "" } } });

    expect(deriveDisplayName(missing)).toBe("Test");
    expect(deriveDisplayName(empty)).toBe("Test");
  });

  it("trims trailing whitespace from data.name", () => {
    const data = makeData({ name: "Sarah ", extensions: {} });

    expect(deriveDisplayName(data)).toBe("Sarah");
  });

  it("falls back to data.name when the slug humanizes to an empty string", () => {
    const data = makeData({
      name: "Test",
      extensions: { source: { full_path: "x/1234567890ab" } },
    });

    expect(deriveDisplayName(data)).toBe("Test");
  });

  it("strips an uppercase hex ObjectId suffix", () => {
    const data = makeData({
      extensions: { source: { full_path: "Author/char-name-ABC123DEF456" } },
    });

    expect(deriveDisplayName(data)).toBe("Char Name");
  });

  it("treats underscores as word separators", () => {
    const data = makeData({
      extensions: { source: { full_path: "Author/my_character" } },
    });

    expect(deriveDisplayName(data)).toBe("My Character");
  });
});
