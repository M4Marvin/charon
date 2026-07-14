import { type } from "arktype";
import type { ValidationError } from "./types.js";

// ── DepthPrompt ──

export const DepthPrompt = type({
  prompt: "string",
  depth: "number",
  role: "'system' | 'user' | 'assistant'",
});

// ── CharacterExtensions ──

export const CharacterExtensions = type({
  "talkativeness?": "number",
  "fav?": "boolean | string",
  "world?": "string",
  "depth_prompt?": DepthPrompt,
  "[string]": "unknown",
});

// ── CharacterBookEntryExtensions ──

export const CharacterBookEntryExtensions = type({
  "position?": "number",
  "exclude_recursion?": "boolean",
  "probability?": "number",
  "useProbability?": "boolean",
  "depth?": "number",
  "selectiveLogic?": "number",
  "group?": "string",
  "group_override?": "boolean",
  "group_weight?": "number",
  "prevent_recursion?": "boolean",
  "delay_until_recursion?": "boolean",
  "scan_depth?": "number | null",
  "match_whole_words?": "boolean | null",
  "use_group_scoring?": "boolean | null",
  "case_sensitive?": "boolean | null",
  "automation_id?": "string",
  "role?": "number",
  "vectorized?": "boolean",
  "display_index?": "number",
  "sticky?": "number | null",
  "cooldown?": "number | null",
  "delay?": "number | null",
  "match_persona_description?": "boolean",
  "match_character_description?": "boolean",
  "match_character_personality?": "boolean",
  "match_character_depth_prompt?": "boolean",
  "match_scenario?": "boolean",
  "match_creator_notes?": "boolean",
  "triggers?": "string[]",
  "ignore_budget?": "boolean",
  "[string]": "unknown",
});

// ── CharacterBookEntry ──

export const CharacterBookEntry = type({
  "id?": "number",
  keys: "string[]",
  "secondary_keys?": "string[]",
  "comment?": "string",
  content: "string",
  "constant?": "boolean",
  "selective?": "boolean",
  insertion_order: "number",
  "enabled?": "boolean",
  "position?": "'before_char' | 'after_char'",
  "case_sensitive?": "boolean",
  "name?": "string",
  "priority?": "number",
  // V3 addition. V2 cards don't have it; V3 cards always do. Engine
  // doesn't act on this yet — pass-through optional field.
  "use_regex?": "boolean",
  "extensions?": CharacterBookEntryExtensions,
});

// ── CharacterBook ──

export const CharacterBook = type({
  "name?": "string",
  "description?": "string",
  "scan_depth?": "number",
  "token_budget?": "number",
  "recursive_scanning?": "boolean",
  extensions: type({ "[string]": "unknown" }),
  entries: CharacterBookEntry.array(),
});

// ── CharacterDataV2 ──

export const CharacterDataV2 = type({
  name: "string",
  description: "string",
  personality: "string",
  scenario: "string",
  first_mes: "string",
  mes_example: "string",
  creator_notes: "string",
  system_prompt: "string",
  post_history_instructions: "string",
  alternate_greetings: "string[]",
  "character_book?": CharacterBook,
  tags: "string[]",
  creator: "string",
  character_version: "string",
  extensions: CharacterExtensions,
  "[string]": "unknown",
});

// ── CharacterCardV2 ──

export const CharacterCardV2 = type({
  spec: "'chara_card_v2'",
  spec_version: "'2.0'",
  data: CharacterDataV2,
  "[string]": "unknown",
});

// ── CharacterAsset (V3) ──

export const CharacterAsset = type({
  type: "string",
  uri: "string",
  name: "string",
  ext: "string",
  "[string]": "unknown",
});

// ── CharacterDataV3 ──
// V3 is a strict superset of V2. All V2 fields are required, plus the
// optional V3-only fields. `group_only_greetings` is required by the V3
// spec but accepts an empty array, so we make it required here.

export const CharacterDataV3 = type({
  // Inherited V2 fields
  name: "string",
  description: "string",
  personality: "string",
  scenario: "string",
  first_mes: "string",
  mes_example: "string",
  creator_notes: "string",
  system_prompt: "string",
  post_history_instructions: "string",
  alternate_greetings: "string[]",
  "character_book?": CharacterBook,
  tags: "string[]",
  creator: "string",
  character_version: "string",
  extensions: CharacterExtensions,
  // V3-only fields
  "assets?": CharacterAsset.array(),
  "nickname?": "string",
  "creator_notes_multilingual?": type({ "[string]": "string" }),
  "source?": "string[]",
  // V3 spec says this field MUST be present. Accept missing for malformed V3
  // cards; the normalizer can default it to [] on import.
  "group_only_greetings?": "string[]",
  "creation_date?": "number",
  "modification_date?": "number",
  "[string]": "unknown",
});

// ── CharacterCardV3 ──
//
// `spec_version` is constrained to any string so the arktype gate accepts
// future minor versions (3.1, 3.2, ...) without code changes. The
// validateCharacterCardV3 function below parses the string as a float and
// rejects anything outside the [3.0, 4.0) range, matching the spec's
// forward-compat guidance. SillyTavern and Chub both accept any 3.x
// version string on read.
//
// `data.group_only_greetings` is per spec a required field, but we make
// it optional in the arktype and let the normalizer default missing
// values to []. Real-world V3 cards (including ones exported by
// SillyTavern and Chub) frequently omit this field, and SillyTavern
// itself does not enforce its presence on read.
export const CharacterCardV3 = type({
  spec: "'chara_card_v3'",
  spec_version: "string",
  data: CharacterDataV3,
  "[string]": "unknown",
});

// ── CharacterCard ──

export const CharacterCard = CharacterCardV2;

// ── CharacterCardV1 (legacy) ──

export const CharacterCardV1 = type({
  name: "string",
  description: "string",
  personality: "string",
  scenario: "string",
  first_mes: "string",
  mes_example: "string",
  "creatorcomment?": "string",
  "tags?": "string[]",
  "talkativeness?": "number",
  "fav?": "boolean | string",
  "create_date?": "string",
  "chat?": "string",
  "avatar?": "string",
  "json_data?": "string",
  "data?": CharacterDataV2,
  "spec?": "string",
  "spec_version?": "string",
  "[string]": "unknown",
});

// ── FlattenedCharacter ──

export const FlattenedCharacter = type({
  name: "string",
  description: "string",
  personality: "string",
  scenario: "string",
  first_mes: "string",
  mes_example: "string",
  creatorcomment: "string",
  avatar: "string",
  chat: "string",
  talkativeness: "number",
  fav: "boolean",
  tags: "string[]",
  spec: "'chara_card_v2'",
  spec_version: "'2.0'",
  data: CharacterDataV2,
  "create_date?": "string",
  "creator?": "string",
  "character_version?": "string",
  "system_prompt?": "string",
  "post_history_instructions?": "string",
  "alternate_greetings?": "string[]",
  "character_book?": CharacterBook,
  "depth_prompt_prompt?": "string",
  "depth_prompt_depth?": "number",
  "depth_prompt_role?": "string",
  "extensions?": type({ "[string]": "unknown" }),
});

// ── Validation helpers ──

function mapError(e: { path?: unknown; message: string }): ValidationError {
  return { field: typeof e.path === "string" ? e.path : "", message: e.message };
}

/**
 * Attempt to parse and validate a character card from unknown data.
 */
export function validateCharacterCard(
  data: unknown,
): { ok: true; card: typeof CharacterCard.infer } | { ok: false; errors: ValidationError[] } {
  const result = CharacterCard(data);
  if (result instanceof type.errors) {
    return { ok: false, errors: result.map(mapError) };
  }
  return { ok: true, card: result };
}

/**
 * Attempt to parse and validate a V3 character card from unknown data.
 * V3 spec: https://github.com/kwaroran/character-card-spec-v3
 *
 * Leniency (matches SillyTavern and Chub on read):
 *   - `spec_version` accepts any 3.x string ("3.0", "3.1", ...). We
 *     parse as float and require [3.0, 4.0). Future spec versions are
 *     accepted; major-version jumps are not.
 *   - `data.group_only_greetings` is treated as optional. Real-world
 *     cards frequently omit it; the normalizer defaults it to [].
 *   - `use_regex` on lorebook entries is treated as optional. SillyTavern
 *     and Chub do not require it; the normalizer defaults to false.
 *
 * The strict spec says these are required; we relax to match the
 * practical behavior of the wider ecosystem.
 */
export function validateCharacterCardV3(
  data: unknown,
): { ok: true; card: typeof CharacterCardV3.infer } | { ok: false; errors: ValidationError[] } {
  const result = CharacterCardV3(data);
  if (result instanceof type.errors) {
    return { ok: false, errors: result.map(mapError) };
  }
  // Forward-compat: spec_version is any 3.x value, per the V3 spec
  // recommendation. Reject major-version jumps.
  if (typeof result.spec_version === "string") {
    const v = Number.parseFloat(result.spec_version);
    if (Number.isNaN(v) || v < 3.0 || v >= 4.0) {
      return {
        ok: false,
        errors: [
          {
            field: "spec_version",
            message: `Expected a 3.x version string (got "${result.spec_version}")`,
          },
        ],
      };
    }
  }
  return { ok: true, card: result };
}

/**
 * Attempt to parse and validate a character book from unknown data.
 */
export function validateCharacterBook(
  data: unknown,
): { ok: true; book: typeof CharacterBook.infer } | { ok: false; errors: ValidationError[] } {
  const result = CharacterBook(data);
  if (result instanceof type.errors) {
    return { ok: false, errors: result.map(mapError) };
  }
  return { ok: true, book: result };
}

/**
 * Attempt to parse and validate a character book entry from unknown data.
 */
export function validateCharacterBookEntry(
  data: unknown,
): { ok: true; entry: typeof CharacterBookEntry.infer } | { ok: false; errors: ValidationError[] } {
  const result = CharacterBookEntry(data);
  if (result instanceof type.errors) {
    return { ok: false, errors: result.map(mapError) };
  }
  return { ok: true, entry: result };
}
