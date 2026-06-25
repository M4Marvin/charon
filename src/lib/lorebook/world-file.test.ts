import { describe, expect, it } from "vitest";
import { parseWorldFile } from "@/lib/lorebook/world-file";
import { DEFAULT_LORE_CONFIG } from "@/lib/st-core/lorebook";

function makeValidEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uid: 1,
    key: ["dragon", "wyrm"],
    keysecondary: [],
    comment: "A dragon lore entry",
    content: "Dragons are ancient creatures.",
    constant: false,
    selective: false,
    insertion_order: 100,
    enabled: true,
    position: "before_char",
    use_regex: true,
    extensions: {
      position: 0,
      exclude_recursion: false,
      prevent_recursion: false,
      delay_until_recursion: false,
      depth: 4,
      selectiveLogic: 0,
      group: "",
      group_override: false,
      group_weight: 100,
      probability: 100,
      useProbability: true,
      automation_id: "",
      role: 0,
      triggers: [],
      ignore_budget: false,
    },
    ...overrides,
  };
}

function makeValidWorld(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "World Guide",
    description: "A test world",
    scanDepth: 12,
    entries: {
      "0": makeValidEntry({ uid: 0 }),
      "1": makeValidEntry({ uid: 1, key: ["other"], content: "Other content" }),
    },
    ...overrides,
  };
}

describe("parseWorldFile", () => {
  it("parses a valid world file with name, description, config, and entries", () => {
    const result = parseWorldFile(JSON.stringify(makeValidWorld()));
    expect(result.name).toBe("World Guide");
    expect(result.description).toBe("A test world");
    expect(result.config.scanDepth).toBe(12);
    expect(result.config.depth).toBe(DEFAULT_LORE_CONFIG.depth);
    expect(result.entries).toHaveLength(2);
    expect(result.entriesSkipped).toBe(0);
  });

  it("falls back to 'Imported Lorebook' when name is missing or empty", () => {
    expect(parseWorldFile(JSON.stringify({ entries: {} })).name).toBe("Imported Lorebook");
    expect(parseWorldFile(JSON.stringify({ name: "  ", entries: {} })).name).toBe(
      "Imported Lorebook",
    );
  });

  it("uses null description when missing or empty", () => {
    expect(parseWorldFile(JSON.stringify({ entries: {} })).description).toBeNull();
    expect(parseWorldFile(JSON.stringify({ description: "", entries: {} })).description).toBeNull();
  });

  it("normalizes enabled=true to disable=false", () => {
    const result = parseWorldFile(JSON.stringify(makeValidWorld()));
    expect(result.entries[0]?.disable).toBe(false);
  });

  it("normalizes enabled=false to disable=true", () => {
    const result = parseWorldFile(
      JSON.stringify(
        makeValidWorld({
          entries: { "0": makeValidEntry({ uid: 0, enabled: false }) },
        }),
      ),
    );
    expect(result.entries[0]?.disable).toBe(true);
  });

  it("normalizes enabled missing to disable=false (default on)", () => {
    const result = parseWorldFile(
      JSON.stringify(
        makeValidWorld({
          entries: { "0": makeValidEntry({ uid: 0, enabled: undefined }) },
        }),
      ),
    );
    expect(result.entries[0]?.disable).toBe(false);
  });

  it("maps position 'before_char' to 0", () => {
    const result = parseWorldFile(JSON.stringify(makeValidWorld()));
    expect(result.entries[0]?.position).toBe(0);
  });

  it("maps position 'after_char' to 1", () => {
    const result = parseWorldFile(
      JSON.stringify(
        makeValidWorld({
          entries: {
            "0": makeValidEntry({
              uid: 0,
              position: "after_char",
              // Clear extensions.position so the top-level value is used.
              extensions: { position: undefined },
            }),
          },
        }),
      ),
    );
    expect(result.entries[0]?.position).toBe(1);
  });

  it("prefers extensions.position over top-level position when both present", () => {
    const result = parseWorldFile(
      JSON.stringify(
        makeValidWorld({
          entries: {
            "0": makeValidEntry({
              uid: 0,
              position: "before_char",
              extensions: { position: 1 },
            }),
          },
        }),
      ),
    );
    expect(result.entries[0]?.position).toBe(1);
  });

  it("renames insertion_order to order", () => {
    const result = parseWorldFile(JSON.stringify(makeValidWorld()));
    expect(result.entries[0]?.order).toBe(100);
  });

  it("handles key as a comma-separated string", () => {
    const result = parseWorldFile(
      JSON.stringify(
        makeValidWorld({
          entries: { "0": makeValidEntry({ uid: 0, key: "dragon, wyrm, drake" }) },
        }),
      ),
    );
    expect(result.entries[0]?.key).toEqual(["dragon", "wyrm", "drake"]);
  });

  it("handles keysecondary as a comma-separated string", () => {
    const result = parseWorldFile(
      JSON.stringify(
        makeValidWorld({
          entries: { "0": makeValidEntry({ uid: 0, keysecondary: "fire, scales" }) },
        }),
      ),
    );
    expect(result.entries[0]?.keysecondary).toEqual(["fire", "scales"]);
  });

  it("returns no entries and no skip when entries is missing", () => {
    const result = parseWorldFile(JSON.stringify({ name: "Empty" }));
    expect(result.entries).toEqual([]);
    expect(result.entriesSkipped).toBe(0);
  });

  it("counts non-object entries (null, primitives) as skipped and keeps valid ones", () => {
    // The parser fills defaults for all required fields, so a well-formed
    // object always passes LoreEntrySchema. The only way to get a skip is
    // a non-object value in the entries record.
    const result = parseWorldFile(
      JSON.stringify({
        name: "Mixed",
        entries: {
          "0": makeValidEntry({ uid: 0 }),
          "1": null,
          "2": "not an object",
          "3": makeValidEntry({ uid: 3, key: ["ok"] }),
        },
      }),
    );
    expect(result.entries).toHaveLength(2);
    expect(result.entriesSkipped).toBe(2);
  });

  it("skips entries that are not objects (e.g., null, arrays, primitives)", () => {
    const result = parseWorldFile(
      JSON.stringify({
        name: "Weird",
        entries: {
          "0": makeValidEntry({ uid: 0 }),
          "1": null,
          "2": "not an object",
          "3": makeValidEntry({ uid: 3 }),
        },
      }),
    );
    expect(result.entries).toHaveLength(2);
    expect(result.entriesSkipped).toBe(2);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseWorldFile("not json")).toThrow(/Invalid world file/);
  });

  it("throws on JSON that is not an object", () => {
    expect(() => parseWorldFile("[]")).toThrow(/Invalid world file/);
    expect(() => parseWorldFile("42")).toThrow(/Invalid world file/);
    expect(() => parseWorldFile("null")).toThrow(/Invalid world file/);
  });

  it("uses default scanDepth when not provided", () => {
    const result = parseWorldFile(JSON.stringify({ name: "X", entries: {} }));
    expect(result.config.scanDepth).toBe(DEFAULT_LORE_CONFIG.scanDepth);
  });

  it("floors and clamps negative scanDepth to 0", () => {
    const result = parseWorldFile(JSON.stringify({ name: "X", entries: {}, scanDepth: -5.7 }));
    expect(result.config.scanDepth).toBe(0);
  });

  it("ignores non-finite scanDepth", () => {
    const result = parseWorldFile(JSON.stringify({ name: "X", entries: {}, scanDepth: NaN }));
    expect(result.config.scanDepth).toBe(DEFAULT_LORE_CONFIG.scanDepth);
  });

  it("assigns fallback uids when entries have no uid", () => {
    const result = parseWorldFile(
      JSON.stringify({
        name: "NoUid",
        entries: {
          a: { key: ["a"], content: "A" },
          b: { key: ["b"], content: "B" },
        },
      }),
    );
    expect(result.entries.map((e) => e.uid)).toEqual([1, 2]);
  });

  it("advances fallback uid past explicit uids to avoid collisions", () => {
    const result = parseWorldFile(
      JSON.stringify({
        name: "Mixed",
        entries: {
          a: { uid: 5, key: ["a"], content: "A" },
          b: { key: ["b"], content: "B" },
        },
      }),
    );
    expect(result.entries.map((e) => e.uid)).toEqual([5, 6]);
  });
});
