// Card normalization (legacy ST data + benign real-world V2 violations)
//
// Real-world SillyTavern cards frequently violate the V2 spec in benign ways:
//   - extensions.talkativeness is the string "0.5" instead of a number
//   - extensions.depth_prompt.role is missing or empty
//   - character_book is null instead of omitted
//   - character_book.extensions is missing
//   - character_book.entries[].position is "" (sentinel for "default")
//   - character_book.entries[] is missing required fields like keys/content
//
// The strict validateCharacterCard arktype gate rejects these even though the
// card is fine in practice. Both the user-facing importCharacter server fn and
// the legacy data migration run cards through this normalizer before the
// strict validator, so uploads and migrations get identical leniency.
//
// V3 cards (spec: chara_card_v3) are projected down to a V2-shaped object
// via `normalizeV3ToV2`. V3-only fields (`assets`, `nickname`,
// `creator_notes_multilingual`, `source`, `group_only_greetings`,
// `creation_date`, `modification_date`) are stashed under
// `data.extensions._v3` so the card can be losslessly re-emitted on export.
// Callers should then run `normalizeCardData` to apply the V2 benevolence
// fixes before the strict V2 arktype gate.

import type { CharacterBook } from "@/lib/st-core/character";

type RawCardEntry = Record<string, unknown> & {
  keys?: unknown;
  content?: unknown;
  position?: unknown;
  enabled?: unknown;
  insertion_order?: unknown;
};

type RawCardBook = Record<string, unknown> & {
  entries?: unknown;
  extensions?: unknown;
};

type RawCardData = Record<string, unknown> & {
  name?: unknown;
  extensions?: Record<string, unknown>;
  character_book?: unknown;
  // V3-only fields. Read by normalizeV3ToV2, then removed from `data`.
  assets?: unknown;
  nickname?: unknown;
  creator_notes_multilingual?: unknown;
  source?: unknown;
  group_only_greetings?: unknown;
  creation_date?: unknown;
  modification_date?: unknown;
};

const VALID_POSITIONS = new Set(["before_char", "after_char"]);

function normalizeBookEntry(entry: RawCardEntry): RawCardEntry | null {
  if (!Array.isArray(entry.keys) || entry.keys.length === 0) return null;
  if (typeof entry.content !== "string" || entry.content.length === 0) return null;

  const out: RawCardEntry = { ...entry };

  if (typeof out.position !== "string" || !VALID_POSITIONS.has(out.position)) {
    delete out.position;
  }
  if (typeof out.enabled !== "boolean") {
    out.enabled = true;
  }
  if (typeof out.insertion_order !== "number") {
    out.insertion_order = 100;
  }
  if (typeof out.secondary_keys !== "object" || out.secondary_keys === null) {
    out.secondary_keys = [];
  }
  if (typeof out.selective === "undefined") {
    out.selective = false;
  }
  if (typeof out.constant === "undefined") {
    out.constant = false;
  }

  return out;
}

function normalizeCharacterBook(raw: unknown): CharacterBook | null {
  if (!raw || typeof raw !== "object") return null;
  const book = raw as RawCardBook;

  const entriesIn = Array.isArray(book.entries) ? (book.entries as RawCardEntry[]) : [];
  const entriesOut = entriesIn.map(normalizeBookEntry).filter((e): e is RawCardEntry => e !== null);

  if (entriesOut.length === 0) return null;

  // Build the book, omitting optional fields when not present (arktype treats
  // `undefined` as "was undefined", not "missing"; an explicit key with
  // undefined value fails the `?:` optional schema).
  const out: CharacterBook = {
    entries: entriesOut as unknown as CharacterBook["entries"],
    extensions:
      book.extensions && typeof book.extensions === "object" && !Array.isArray(book.extensions)
        ? (book.extensions as Record<string, unknown>)
        : {},
  };
  if (typeof book.name === "string") out.name = book.name;
  if (typeof book.description === "string") out.description = book.description;
  if (typeof book.scan_depth === "number") out.scan_depth = book.scan_depth;
  if (typeof book.token_budget === "number") out.token_budget = book.token_budget;
  if (typeof book.recursive_scanning === "boolean")
    out.recursive_scanning = book.recursive_scanning;
  return out;
}

export function normalizeCardData(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const card = raw as { data?: unknown };
  if (!card.data || typeof card.data !== "object") return raw;

  const data = card.data as RawCardData;

  // extensions.talkativeness: coerce string → number
  if (data.extensions && typeof data.extensions === "object") {
    const ext = data.extensions as Record<string, unknown>;
    if (typeof ext.talkativeness === "string") {
      const n = Number.parseFloat(ext.talkativeness);
      if (!Number.isNaN(n)) {
        ext.talkativeness = n;
      } else {
        delete ext.talkativeness;
      }
    }
    // extensions.depth_prompt.role: must be valid or remove
    if (ext.depth_prompt && typeof ext.depth_prompt === "object") {
      const dp = ext.depth_prompt as Record<string, unknown>;
      if (dp.role !== "system" && dp.role !== "user" && dp.role !== "assistant") {
        delete ext.depth_prompt;
      }
    }
  }

  // character_book: normalize or remove
  if (data.character_book !== undefined) {
    const book = normalizeCharacterBook(data.character_book);
    if (book) {
      data.character_book = book;
    } else {
      delete data.character_book;
    }
  }

  return raw;
}

// ── V3 → V2 projection ──
//
// V3 cards are a strict superset of V2, but the DB column is typed
// `CharacterDataV2`. Rather than widen the column or write a custom V3
// validator for every consumer, we project a V3 card down to V2 by:
//   1. Pulling V3-only fields off `data`.
//   2. Stashing them in `data.extensions._v3` so the original V3 data
//      survives round-trip on export.
//   3. Returning the V2-shaped object, which then passes through
//      `normalizeCardData` and the V2 strict arktype gate.
//
// The `_v3` stash is namespaced so it never collides with ST's
// `extensions` namespace. Callers that need to re-emit the V3 JSON read
// it back and build a V3-shaped object.
//
// We also default `group_only_greetings` to `[]` if missing — the V3
// spec requires the field but real-world cards sometimes omit it, and
// `use_regex` on lorebook entries to `false` so the V2 arktype gate
// doesn't trip (V2 strict accepts it as optional, but we ensure it's
// present when stashed).
export function normalizeV3ToV2(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const card = raw as { data?: unknown };
  if (!card.data || typeof card.data !== "object") return raw;

  const data = card.data as RawCardData;
  const stash: Record<string, unknown> = {};

  // assets: array of { type, uri, name, ext } (validated by stashed shape only)
  if (Array.isArray(data.assets)) {
    stash.assets = data.assets;
    delete data.assets;
  }

  if (typeof data.nickname === "string" && data.nickname.length > 0) {
    stash.nickname = data.nickname;
    delete data.nickname;
  }

  if (data.creator_notes_multilingual && typeof data.creator_notes_multilingual === "object") {
    stash.creatorNotesMultilingual = data.creator_notes_multilingual;
    delete data.creator_notes_multilingual;
  }

  if (Array.isArray(data.source)) {
    stash.source = data.source;
    delete data.source;
  }

  if (Array.isArray(data.group_only_greetings)) {
    stash.groupOnlyGreetings = data.group_only_greetings;
    delete data.group_only_greetings;
  }
  // We don't stash a default `groupOnlyGreetings: []` if the input was
  // missing the field. The V3 spec requires the field, but a missing value
  // round-trips as a missing value — round-trip faithfulness over spec
  // strictness. The V3 arktype still accepts the field as optional.

  if (typeof data.creation_date === "number") {
    stash.creationDate = data.creation_date;
    delete data.creation_date;
  }

  if (typeof data.modification_date === "number") {
    stash.modificationDate = data.modification_date;
    delete data.modification_date;
  }

  // Walk lorebook entries to default `use_regex` and coerce string `id`s.
  // We match SillyTavern/Chub on read: missing `use_regex` is silently
  // defaulted to `false` (the V3 spec marks it as required, but real-world
  // cards omit it), and string ids are coerced to numbers when the string
  // is a clean integer (the st-core lorebook engine uses numeric uids).
  if (data.character_book && typeof data.character_book === "object") {
    const book = data.character_book as {
      entries?: Array<Record<string, unknown>>;
      [k: string]: unknown;
    };
    if (Array.isArray(book.entries)) {
      for (const entry of book.entries) {
        if (typeof entry !== "object" || entry === null) continue;
        if (typeof entry.use_regex !== "boolean") {
          entry.use_regex = false;
        }
        if (typeof entry.id === "string") {
          const n = Number.parseInt(entry.id, 10);
          if (!Number.isNaN(n) && String(n) === entry.id.trim()) {
            entry.id = n;
          } else {
            delete entry.id;
          }
        }
      }
    }
  }

  if (Object.keys(stash).length === 0) return raw;

  // Ensure data.extensions exists, then write the stash.
  if (!data.extensions || typeof data.extensions !== "object" || Array.isArray(data.extensions)) {
    data.extensions = {};
  }
  (data.extensions as Record<string, unknown>)._v3 = stash;

  return raw;
}
