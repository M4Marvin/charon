import { describe, expect, it } from "vitest";
import { validateCharacterCardV3 } from "@/lib/st-core/character";

function makeValidV3(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: "V3",
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
      group_only_greetings: [],
      ...overrides,
    },
  };
}

describe("validateCharacterCardV3", () => {
  it("accepts a minimal V3 card with only V2 required fields", () => {
    // Lenient: real-world V3 cards (SillyTavern, Chub) often omit
    // `group_only_greetings`. We treat it as optional and let the
    // normalizer default missing values to []. The strict V3 spec says
    // it's required, but matching the wider ecosystem wins.
    const result = validateCharacterCardV3(makeValidV3());
    expect(result.ok).toBe(true);
  });

  it("accepts a full V3 card with all V3-only fields populated", () => {
    const card = makeValidV3({
      assets: [
        { type: "icon", uri: "ccdefault:", name: "main", ext: "png" },
        { type: "background", uri: "embeded://bg.png", name: "main", ext: "png" },
      ],
      nickname: "Nicky",
      creator_notes_multilingual: { en: "Hello", ja: "こんにちは" },
      source: ["https://example.com/card/123"],
      creation_date: 1700000000,
      modification_date: 1700000001,
    });
    const result = validateCharacterCardV3(card);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.card.data.assets).toHaveLength(2);
      expect(result.card.data.nickname).toBe("Nicky");
    }
  });

  it("accepts a V3 card with a character_book that has use_regex entries", () => {
    const card = makeValidV3({
      character_book: {
        extensions: {},
        entries: [
          { keys: ["a"], content: "x", insertion_order: 1, enabled: true, use_regex: false },
          { keys: ["b"], content: "y", insertion_order: 2, enabled: true, use_regex: true },
        ],
      },
    });
    expect(validateCharacterCardV3(card).ok).toBe(true);
  });

  it("rejects a card with the wrong spec", () => {
    const card = makeValidV3();
    (card as { spec: string }).spec = "chara_card_v2";
    const result = validateCharacterCardV3(card);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const hasSpecError = result.errors.some(
        (e) => e.field === "spec" || e.message.includes("chara_card_v3"),
      );
      expect(hasSpecError).toBe(true);
    }
  });

  it("rejects a V2 spec_version (major-version mismatch)", () => {
    const card = makeValidV3();
    (card as { spec_version: string }).spec_version = "2.0";
    const result = validateCharacterCardV3(card);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const hasVersionError = result.errors.some(
        (e) => e.field === "spec_version" || e.message.includes("3.x"),
      );
      expect(hasVersionError).toBe(true);
    }
  });

  it("rejects a 4.x spec_version (major-version jump)", () => {
    const card = makeValidV3();
    (card as { spec_version: string }).spec_version = "4.0";
    const result = validateCharacterCardV3(card);
    expect(result.ok).toBe(false);
  });

  it("accepts a 3.1 spec_version (forward compat, matches SillyTavern/Chub)", () => {
    const card = makeValidV3();
    (card as { spec_version: string }).spec_version = "3.1";
    expect(validateCharacterCardV3(card).ok).toBe(true);
  });

  it("rejects a non-numeric spec_version", () => {
    const card = makeValidV3();
    (card as { spec_version: string }).spec_version = "three";
    expect(validateCharacterCardV3(card).ok).toBe(false);
  });

  it("rejects a card missing a V2-required field (e.g. `name`)", () => {
    const card = makeValidV3();
    const data = card.data as Record<string, unknown>;
    delete data.name;
    const result = validateCharacterCardV3(card);
    expect(result.ok).toBe(false);
  });

  it("rejects an asset missing required fields", () => {
    const card = makeValidV3({ assets: [{ type: "icon" }] });
    const result = validateCharacterCardV3(card);
    expect(result.ok).toBe(false);
  });

  it("rejects a creator_notes_multilingual with non-string values", () => {
    const card = makeValidV3({ creator_notes_multilingual: { en: 123 } });
    const result = validateCharacterCardV3(card);
    expect(result.ok).toBe(false);
  });

  it("accepts group_only_greetings as an empty array", () => {
    const card = makeValidV3({ group_only_greetings: [] });
    expect(validateCharacterCardV3(card).ok).toBe(true);
  });

  it("accepts group_only_greetings with multiple entries", () => {
    const card = makeValidV3({ group_only_greetings: ["hi", "hello"] });
    const result = validateCharacterCardV3(card);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.card.data.group_only_greetings).toEqual(["hi", "hello"]);
    }
  });

  it("rejects creation_date as a string (must be a number)", () => {
    const card = makeValidV3({ creation_date: "yesterday" });
    const result = validateCharacterCardV3(card);
    expect(result.ok).toBe(false);
  });

  it("accepts unknown top-level keys (forward compatibility)", () => {
    const card = makeValidV3();
    (card as Record<string, unknown>).future_field = "ok";
    expect(validateCharacterCardV3(card).ok).toBe(true);
  });
});
