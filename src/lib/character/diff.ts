import type { CharacterDataV2 } from "@/lib/st-core/character";

export type CharacterSnapshot = {
  name: string;
  tagline: string | null;
  data: CharacterDataV2;
};

export type FieldDiff = {
  /** Machine field key (card data key, or a synthetic key for derived rows). */
  field: string;
  /** Human label shown in the UI. */
  label: string;
  before: string;
  after: string;
};

/** Single-line scalar fields on the card, compared verbatim. */
const SCALAR_FIELDS: { key: keyof CharacterDataV2; label: string }[] = [
  { key: "description", label: "Description" },
  { key: "personality", label: "Personality" },
  { key: "scenario", label: "Scenario" },
  { key: "first_mes", label: "First message" },
  { key: "mes_example", label: "Message examples" },
  { key: "creator_notes", label: "Creator notes" },
  { key: "system_prompt", label: "System prompt" },
  { key: "post_history_instructions", label: "Post-history instructions" },
  { key: "creator", label: "Creator" },
  { key: "character_version", label: "Card version" },
];

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

/** Identify a lorebook entry by its activation keys, for the diff label. */
function entryKeysLabel(...entries: unknown[]): string {
  for (const entry of entries) {
    const keys = (entry as { keys?: unknown } | null | undefined)?.keys;
    if (Array.isArray(keys) && keys.length > 0) {
      const text = keys.map(String).join(", ");
      return text.length > 40 ? ` (${text.slice(0, 40)}…)` : ` (${text})`;
    }
  }
  return "";
}

/**
 * Field-level diff between two card snapshots. Only changed fields are
 * returned, in a stable display order: scalar fields, then list fields, then
 * the embedded lorebook (count changes as one row; same-count content
 * changes as one row per changed entry).
 */
export function diffCharacterSnapshots(a: CharacterSnapshot, b: CharacterSnapshot): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  const scalarRows: { field: string; label: string; before: string; after: string }[] = [
    { field: "name", label: "Name", before: a.name, after: b.name },
    { field: "tagline", label: "Tagline", before: a.tagline ?? "", after: b.tagline ?? "" },
  ];
  for (const { key, label } of SCALAR_FIELDS) {
    scalarRows.push({
      field: key as string,
      label,
      before: asText(a.data[key]),
      after: asText(b.data[key]),
    });
  }
  for (const row of scalarRows) {
    if (row.before !== row.after) diffs.push(row);
  }

  // Talkativeness is the one extensions field the edit form writes; cards may
  // carry it as a string or number, so compare and render via text.
  const aTalk = a.data.extensions?.talkativeness;
  const bTalk = b.data.extensions?.talkativeness;
  if (asText(aTalk) !== asText(bTalk)) {
    diffs.push({
      field: "extensions.talkativeness",
      label: "Talkativeness",
      before: asText(aTalk),
      after: asText(bTalk),
    });
  }

  // Lists compare structurally (JSON) so a greeting containing a literal
  // "---" line, or a tag containing a comma, can never compare equal to a
  // differently shaped list. Display stays human-readable via asText.
  const aGreetings = JSON.stringify(a.data.alternate_greetings ?? []);
  const bGreetings = JSON.stringify(b.data.alternate_greetings ?? []);
  if (aGreetings !== bGreetings) {
    diffs.push({
      field: "alternate_greetings",
      label: "Alternate greetings",
      before: asText(a.data.alternate_greetings),
      after: asText(b.data.alternate_greetings),
    });
  }

  if (JSON.stringify(a.data.tags ?? []) !== JSON.stringify(b.data.tags ?? [])) {
    diffs.push({
      field: "tags",
      label: "Tags",
      before: asText(a.data.tags),
      after: asText(b.data.tags),
    });
  }

  const aBookEntries = a.data.character_book?.entries;
  const bBookEntries = b.data.character_book?.entries;
  const aBook = Array.isArray(aBookEntries) ? aBookEntries : [];
  const bBook = Array.isArray(bBookEntries) ? bBookEntries : [];
  if (aBook.length !== bBook.length) {
    diffs.push({
      field: "character_book.entries",
      label: "Lorebook entries",
      before: String(aBook.length),
      after: String(bBook.length),
    });
  } else {
    // Same count but different content — the most common card revision
    // (edited keys, content, or enabled flags) — must not read as an empty
    // diff. Report each changed entry: a single whole-array JSON row would
    // excerpt to identical prefixes in the revisions UI.
    for (let i = 0; i < aBook.length; i++) {
      const before = JSON.stringify(aBook[i]) ?? "";
      const after = JSON.stringify(bBook[i]) ?? "";
      if (before === after) continue;
      diffs.push({
        field: `character_book.entries[${i}]`,
        label: `Lorebook entry ${i + 1}${entryKeysLabel(bBook[i], aBook[i])}`,
        before,
        after,
      });
    }
  }

  // Untracked extensions (depth_prompt rides in seed data and whole-card
  // swaps) are invisible to the fields above. When nothing tracked differs
  // but extensions do, surface the delta so an empty diff never claims the
  // cards are identical. Scalar keys whose text matches (legacy cards may
  // type talkativeness as string or number) count as unchanged.
  if (diffs.length === 0) {
    const aExt = (a.data.extensions ?? {}) as Record<string, unknown>;
    const bExt = (b.data.extensions ?? {}) as Record<string, unknown>;
    const sameScalarText = (x: unknown, y: unknown) =>
      (typeof x === "string" || typeof x === "number") &&
      (typeof y === "string" || typeof y === "number") &&
      asText(x) === asText(y);
    const keys = [...new Set([...Object.keys(aExt), ...Object.keys(bExt)])].filter(
      (k) =>
        !sameScalarText(aExt[k], bExt[k]) && JSON.stringify(aExt[k]) !== JSON.stringify(bExt[k]),
    );
    if (keys.length > 0) {
      const pick = (ext: Record<string, unknown>) =>
        JSON.stringify(Object.fromEntries(keys.map((k) => [k, ext[k]])));
      diffs.push({
        field: "extensions",
        label: keys.length === 1 ? `Extension: ${keys[0]}` : `Extensions (${keys.length} changed)`,
        before: pick(aExt),
        after: pick(bExt),
      });
    }
  }

  return diffs;
}
