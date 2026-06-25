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
