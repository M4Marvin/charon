import { describe, expect, it } from "vitest";

import { normalizeCardData, normalizeV3ToV2 } from "@/lib/character/normalize";
import { validateCharacterCard, validateCharacterCardV3 } from "@/lib/st-core/character";

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

function makeValidV3Card(): Record<string, unknown> {
  return {
    spec: "chara_card_v3",
    spec_version: "3.0",
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

describe("normalizeV3ToV2", () => {
  it("stashes V3-only fields into data.extensions._v3", () => {
    const card = makeValidV3Card();
    const data = card.data as Record<string, unknown>;
    data.assets = [{ type: "icon", uri: "ccdefault:", name: "main", ext: "png" }];
    data.nickname = "Nicky";
    data.creator_notes_multilingual = { en: "Hi" };
    data.source = ["https://example.com/x"];
    data.group_only_greetings = ["g1"];
    data.creation_date = 1700000000;
    data.modification_date = 1700000001;

    const out = normalizeV3ToV2(card) as Record<string, unknown>;
    const outData = out.data as Record<string, unknown>;
    const ext = outData.extensions as Record<string, unknown>;
    const stash = ext._v3 as Record<string, unknown>;

    // V3-only fields are removed from `data`
    expect("assets" in outData).toBe(false);
    expect("nickname" in outData).toBe(false);
    expect("creator_notes_multilingual" in outData).toBe(false);
    expect("source" in outData).toBe(false);
    expect("group_only_greetings" in outData).toBe(false);
    expect("creation_date" in outData).toBe(false);
    expect("modification_date" in outData).toBe(false);

    // And present in the stash
    expect(stash.assets).toEqual([{ type: "icon", uri: "ccdefault:", name: "main", ext: "png" }]);
    expect(stash.nickname).toBe("Nicky");
    expect(stash.creatorNotesMultilingual).toEqual({ en: "Hi" });
    expect(stash.source).toEqual(["https://example.com/x"]);
    expect(stash.groupOnlyGreetings).toEqual(["g1"]);
    expect(stash.creationDate).toBe(1700000000);
    expect(stash.modificationDate).toBe(1700000001);
  });

  it("tolerates a missing groupOnlyGreetings (lenient, matches SillyTavern/Chub)", () => {
    // The V3 spec marks `group_only_greetings` as MUST be present, but
    // real-world cards (including ones exported by SillyTavern and Chub)
    // frequently omit it. We accept the card and round-trip the missing
    // value as missing — no defaulting, no error. This matches how
    // SillyTavern and Chub read these cards.
    const card = makeValidV3Card();
    const out = normalizeV3ToV2(card) as Record<string, unknown>;
    const outData = out.data as Record<string, unknown>;
    if ("extensions" in outData) {
      const ext = outData.extensions as Record<string, unknown>;
      const stash = ext._v3 as Record<string, unknown> | undefined;
      if (stash) {
        expect("groupOnlyGreetings" in stash).toBe(false);
      }
    }
  });

  it("leaves a V3 card with no V3-only fields functionally untouched", () => {
    const card = makeValidV3Card();
    const out = normalizeV3ToV2(card) as Record<string, unknown>;
    const outData = out.data as Record<string, unknown>;
    // No `_v3` stash when no V3 fields are present (avoids empty objects).
    if ("extensions" in outData) {
      const ext = outData.extensions as Record<string, unknown>;
      expect("_v3" in ext).toBe(false);
    }
  });

  it("preserves existing data.extensions when stashing V3 fields", () => {
    const card = makeValidV3Card();
    (card.data as Record<string, unknown>).extensions = { talkativeness: 0.5 };
    (card.data as Record<string, unknown>).nickname = "Nicky";

    const out = normalizeV3ToV2(card) as Record<string, unknown>;
    const outData = out.data as Record<string, unknown>;
    const ext = outData.extensions as Record<string, unknown>;
    expect(ext.talkativeness).toBe(0.5);
    expect((ext._v3 as Record<string, unknown>).nickname).toBe("Nicky");
  });

  it("creates data.extensions when missing and V3 fields are present", () => {
    const card = makeValidV3Card();
    const data = card.data as Record<string, unknown>;
    delete data.extensions;
    data.nickname = "Nicky";

    const out = normalizeV3ToV2(card) as Record<string, unknown>;
    const outData = out.data as Record<string, unknown>;
    const ext = outData.extensions as Record<string, unknown>;
    expect(ext).toBeDefined();
    expect((ext._v3 as Record<string, unknown>).nickname).toBe("Nicky");
  });

  it("produces a card that passes the V3 validator", () => {
    const card = makeValidV3Card();
    const data = card.data as Record<string, unknown>;
    data.assets = [{ type: "icon", uri: "ccdefault:", name: "main", ext: "png" }];
    data.nickname = "Nicky";
    data.group_only_greetings = ["g1"];

    const out = normalizeV3ToV2(card) as Record<string, unknown>;
    // After V3 → V2 projection the V2 data fields are intact, and the
    // top-level spec is still "chara_card_v3" — so the V3 validator
    // (which validates V2-required fields) is the right gate.
    expect(validateCharacterCardV3(out).ok).toBe(true);
  });

  it("defaults lorebook entry use_regex to false when missing (lenient, matches SillyTavern/Chub)", () => {
    // The V3 spec marks `use_regex` as MUST be present on every entry,
    // but real-world V3 cards (SillyTavern, Chub) often omit it. We
    // accept the entry and default to false so the V2 strict arktype
    // gate doesn't reject the lorebook.
    const card = makeValidV3Card();
    (card.data as Record<string, unknown>).character_book = {
      extensions: {},
      entries: [{ keys: ["a"], content: "x", insertion_order: 1, enabled: true }],
    };

    const out = normalizeV3ToV2(card) as Record<string, unknown>;
    const data = out.data as Record<string, unknown>;
    const book = data.character_book as { entries: Array<Record<string, unknown>> };
    expect(book.entries[0].use_regex).toBe(false);
  });

  it("coerces string lorebook entry id to number when safe", () => {
    const card = makeValidV3Card();
    (card.data as Record<string, unknown>).character_book = {
      extensions: {},
      entries: [{ keys: ["a"], content: "x", insertion_order: 1, enabled: true, id: "42" }],
    };

    const out = normalizeV3ToV2(card) as Record<string, unknown>;
    const data = out.data as Record<string, unknown>;
    const book = data.character_book as { entries: Array<Record<string, unknown>> };
    expect(book.entries[0].id).toBe(42);
  });

  it("drops non-numeric string lorebook entry id", () => {
    const card = makeValidV3Card();
    (card.data as Record<string, unknown>).character_book = {
      extensions: {},
      entries: [{ keys: ["a"], content: "x", insertion_order: 1, enabled: true, id: "abc" }],
    };

    const out = normalizeV3ToV2(card) as Record<string, unknown>;
    const data = out.data as Record<string, unknown>;
    const book = data.character_book as { entries: Array<Record<string, unknown>> };
    expect("id" in book.entries[0]).toBe(false);
  });

  it("ignores non-array assets and non-string nickname", () => {
    const card = makeValidV3Card();
    const data = card.data as Record<string, unknown>;
    (data.assets as unknown) = "not-an-array";
    (data.nickname as unknown) = 42;
    (data.group_only_greetings as unknown) = "not-an-array";

    const out = normalizeV3ToV2(card) as Record<string, unknown>;
    const outData = out.data as Record<string, unknown>;
    expect("assets" in outData).toBe(true);
    expect("nickname" in outData).toBe(true);
    expect("group_only_greetings" in outData).toBe(true);
    // No stash should be created since nothing valid was pulled.
    if ("extensions" in outData) {
      const ext = outData.extensions as Record<string, unknown>;
      expect("_v3" in ext).toBe(false);
    }
  });

  it("round-trips V3 fields through the full normalize pipeline", () => {
    const card = makeValidV3Card();
    const data = card.data as Record<string, unknown>;
    data.assets = [{ type: "icon", uri: "ccdefault:", name: "main", ext: "png" }];
    data.nickname = "Nicky";
    data.group_only_greetings = ["g1"];
    // Add a benign V2 violation so the V2 strict gate would reject without normalize
    (data.extensions as Record<string, unknown>).talkativeness = "0.7";

    const projected = normalizeV3ToV2(card);
    const normalized = normalizeCardData(projected);
    const out = normalized as Record<string, unknown>;
    // The V2 benevolence fixes (talkativeness coercion) ran; the V3
    // stash is intact. V3 validator accepts it (V2 strict gate would
    // reject the V3 spec literal, but V3 validator doesn't).
    expect(validateCharacterCardV3(out).ok).toBe(true);
    const outData = out.data as Record<string, unknown>;
    const ext = outData.extensions as Record<string, unknown>;
    expect(ext.talkativeness).toBe(0.7);
    expect((ext._v3 as Record<string, unknown>).nickname).toBe("Nicky");
  });
});
