import { describe, expect, it } from "vitest";

import { normalizeCardData } from "@/lib/character/normalize";
import { validateCharacterCard } from "@/lib/st-core/character";

function makeValidCard(): Record<string, unknown> {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
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
    },
  };
}

describe("normalizeCardData", () => {
  it("coerces extensions.talkativeness from a numeric string to a number", () => {
    const card = makeValidCard();
    (card.data as Record<string, unknown>).extensions = { talkativeness: "0.5" };

    const out = normalizeCardData(card) as Record<string, unknown>;
    const ext = (out.data as Record<string, unknown>).extensions as Record<string, unknown>;
    expect(ext.talkativeness).toBe(0.5);
    expect(typeof ext.talkativeness).toBe("number");
  });

  it("removes extensions.talkativeness when the string is unparseable", () => {
    const card = makeValidCard();
    (card.data as Record<string, unknown>).extensions = { talkativeness: "abc" };

    const out = normalizeCardData(card) as Record<string, unknown>;
    const ext = (out.data as Record<string, unknown>).extensions as Record<string, unknown>;
    expect("talkativeness" in ext).toBe(false);
  });

  it("removes extensions.depth_prompt when role is missing or invalid", () => {
    const missing = makeValidCard();
    (missing.data as Record<string, unknown>).extensions = {
      depth_prompt: { prompt: "x", depth: 1 },
    };

    const out1 = normalizeCardData(missing) as Record<string, unknown>;
    const ext1 = (out1.data as Record<string, unknown>).extensions as Record<string, unknown>;
    expect("depth_prompt" in ext1).toBe(false);

    const wrongRole = makeValidCard();
    (wrongRole.data as Record<string, unknown>).extensions = {
      depth_prompt: { prompt: "x", depth: 1, role: "tool" },
    };

    const out2 = normalizeCardData(wrongRole) as Record<string, unknown>;
    const ext2 = (out2.data as Record<string, unknown>).extensions as Record<string, unknown>;
    expect("depth_prompt" in ext2).toBe(false);
  });

  it("keeps extensions.depth_prompt when role is a valid value", () => {
    const card = makeValidCard();
    (card.data as Record<string, unknown>).extensions = {
      depth_prompt: { prompt: "x", depth: 1, role: "system" },
    };

    const out = normalizeCardData(card) as Record<string, unknown>;
    const ext = (out.data as Record<string, unknown>).extensions as Record<string, unknown>;
    expect(ext.depth_prompt).toEqual({ prompt: "x", depth: 1, role: "system" });
  });

  it("omits character_book when it is null", () => {
    const card = makeValidCard();
    (card.data as Record<string, unknown>).character_book = null;

    const out = normalizeCardData(card) as Record<string, unknown>;
    const data = out.data as Record<string, unknown>;
    expect("character_book" in data).toBe(false);
  });

  it("drops character_book entries with empty keys or empty content", () => {
    const card = makeValidCard();
    (card.data as Record<string, unknown>).character_book = {
      extensions: {},
      entries: [
        { keys: ["valid"], content: "ok" },
        { keys: [], content: "no keys" },
        { keys: ["no-content"], content: "" },
      ],
    };

    const out = normalizeCardData(card) as Record<string, unknown>;
    const data = out.data as Record<string, unknown>;
    const book = data.character_book as { entries: unknown[] };
    expect(book.entries).toHaveLength(1);
  });

  it("removes character_book entirely if all entries are dropped", () => {
    const card = makeValidCard();
    (card.data as Record<string, unknown>).character_book = {
      extensions: {},
      entries: [{ keys: [], content: "" }],
    };

    const out = normalizeCardData(card) as Record<string, unknown>;
    const data = out.data as Record<string, unknown>;
    expect("character_book" in data).toBe(false);
  });

  it("passes a valid V2 card through unchanged", () => {
    const card = makeValidCard();
    const before = JSON.stringify(card);

    const out = normalizeCardData(card) as Record<string, unknown>;
    expect(JSON.stringify(out)).toBe(before);
    expect(validateCharacterCard(out).ok).toBe(true);
  });

  it("produces a card that passes strict validateCharacterCard when the only issue was a benign violation", () => {
    const card = makeValidCard();
    (card.data as Record<string, unknown>).extensions = { talkativeness: "0.75" };
    (card.data as Record<string, unknown>).character_book = null;

    const before = validateCharacterCard(card).ok;
    expect(before).toBe(false);

    const out = normalizeCardData(card) as Record<string, unknown>;
    expect(validateCharacterCard(out).ok).toBe(true);
  });
});
