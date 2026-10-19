import { describe, expect, it } from "vitest";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { DEFAULT_LORE_ENTRY } from "@/lib/st-core/lorebook/types";
import { mergeLoreEntries } from "./context";

describe("mergeLoreEntries", () => {
  it("merges enabled embedded book entries with non-colliding uids", () => {
    const standalone = {
      ...DEFAULT_LORE_ENTRY,
      uid: 7,
      key: ["standalone"],
      content: "Standalone lore",
    };
    const character = makeCharacterData({
      character_book: {
        name: "Embedded",
        extensions: {},
        entries: [
          {
            id: 1,
            keys: ["dragon"],
            content: "Embedded lore",
            insertion_order: 0,
            enabled: true,
          },
          {
            id: 2,
            keys: ["hidden"],
            content: "Disabled embedded lore",
            insertion_order: 1,
            enabled: false,
          },
        ],
      },
    });

    const merged = mergeLoreEntries([standalone], character);

    expect(merged.map((entry) => entry.content)).toEqual(["Standalone lore", "Embedded lore"]);
    expect(merged.map((entry) => entry.uid)).toEqual([7, 8]);
  });

  it("returns the standalone list unchanged when the card has no book", () => {
    const standalone = { ...DEFAULT_LORE_ENTRY, uid: 3, content: "Only lore" };
    expect(mergeLoreEntries([standalone], makeCharacterData())).toEqual([standalone]);
  });
});
