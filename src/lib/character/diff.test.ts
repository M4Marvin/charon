import { describe, expect, it } from "vitest";
import { diffCharacterSnapshots, type CharacterSnapshot } from "./diff";
import { makeCharacterData } from "@/db/__tests__/character-data";
import type { CharacterDataV2 } from "@/lib/st-core/character";

function snapshot(overrides: {
  name?: string;
  tagline?: string | null;
  data?: Partial<CharacterDataV2>;
}): CharacterSnapshot {
  return {
    name: overrides.name ?? "Test Character",
    tagline: overrides.tagline ?? null,
    data: makeCharacterData(overrides.data),
  };
}

describe("diffCharacterSnapshots", () => {
  it("returns no diffs for identical snapshots", () => {
    const a = snapshot({ tagline: "same" });
    const b = snapshot({ tagline: "same" });
    expect(diffCharacterSnapshots(a, b)).toEqual([]);
  });

  it("detects scalar field changes with labels", () => {
    const a = snapshot({ data: { description: "old", personality: "calm" } });
    const b = snapshot({ data: { description: "new", personality: "calm" } });
    const diffs = diffCharacterSnapshots(a, b);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({
      field: "description",
      label: "Description",
      before: "old",
      after: "new",
    });
  });

  it("detects name and tagline changes from the snapshot scalars", () => {
    const a = snapshot({ name: "Old", tagline: "old tag" });
    const b = snapshot({ name: "New", tagline: "new tag" });
    const diffs = diffCharacterSnapshots(a, b);
    const fields = diffs.map((d) => d.field);
    expect(fields).toContain("name");
    expect(fields).toContain("tagline");
    const nameDiff = diffs.find((d) => d.field === "name");
    expect(nameDiff).toMatchObject({ before: "Old", after: "New" });
  });

  it("treats missing scalar fields as empty strings", () => {
    const a = snapshot({ data: { personality: undefined } as Partial<CharacterDataV2> });
    const b = snapshot({ data: { personality: "brave" } });
    const diffs = diffCharacterSnapshots(a, b);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ before: "", after: "brave" });
  });

  it("joins alternate greetings for comparison but reports the raw list", () => {
    const a = snapshot({ data: { alternate_greetings: ["one"] } });
    const b = snapshot({ data: { alternate_greetings: ["one", "two"] } });
    const diffs = diffCharacterSnapshots(a, b);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.field).toBe("alternate_greetings");
    expect(diffs[0]?.after).toBe("one, two");
  });

  it("detects tag changes as comma-joined text", () => {
    const a = snapshot({ data: { tags: ["elf", "mage"] } });
    const b = snapshot({ data: { tags: ["elf", "orc"] } });
    const diffs = diffCharacterSnapshots(a, b);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ field: "tags", before: "elf, mage", after: "elf, orc" });
  });

  it("reports lorebook entry count changes", () => {
    const a = snapshot({
      data: {
        character_book: { extensions: {}, entries: [] },
      },
    });
    const b = snapshot({
      data: {
        character_book: {
          extensions: {},
          entries: [
            {
              id: 1,
              keys: ["k"],
              content: "c",
              extensions: {},
              enabled: true,
              insertion_order: 100,
            },
          ],
        },
      },
    });
    const diffs = diffCharacterSnapshots(a, b);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({
      field: "character_book.entries",
      label: "Lorebook entries",
      before: "0",
      after: "1",
    });
  });

  it("returns multiple diffs in a stable order", () => {
    const a = snapshot({ name: "Old", data: { description: "d1", scenario: "s1" } });
    const b = snapshot({ name: "New", data: { description: "d2", scenario: "s2" } });
    const fields = diffCharacterSnapshots(a, b).map((d) => d.field);
    expect(fields).toEqual(["name", "description", "scenario"]);
  });
});
