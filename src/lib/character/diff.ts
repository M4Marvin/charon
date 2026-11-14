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

/**
 * Field-level diff between two card snapshots. Only changed fields are
 * returned, in a stable display order: scalar fields, then list fields, then
 * the embedded lorebook entry count.
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

  const aGreetings = (a.data.alternate_greetings ?? []).join("\n---\n");
  const bGreetings = (b.data.alternate_greetings ?? []).join("\n---\n");
  if (aGreetings !== bGreetings) {
    diffs.push({
      field: "alternate_greetings",
      label: "Alternate greetings",
      before: asText(a.data.alternate_greetings),
      after: asText(b.data.alternate_greetings),
    });
  }

  const aTags = asText(a.data.tags);
  const bTags = asText(b.data.tags);
  if (aTags !== bTags) {
    diffs.push({ field: "tags", label: "Tags", before: aTags, after: bTags });
  }

  const aBookCount = a.data.character_book?.entries?.length ?? 0;
  const bBookCount = b.data.character_book?.entries?.length ?? 0;
  if (aBookCount !== bBookCount) {
    diffs.push({
      field: "character_book.entries",
      label: "Lorebook entries",
      before: String(aBookCount),
      after: String(bBookCount),
    });
  }

  return diffs;
}
