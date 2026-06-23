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
});

// ── CharacterCardV2 ──

export const CharacterCardV2 = type({
  spec: "'chara_card_v2'",
  spec_version: "'2.0'",
  data: CharacterDataV2,
});

// ── CharacterCardV3 ──

export const CharacterCardV3 = type({
  spec: "'chara_card_v3'",
  spec_version: "string",
  data: type({ "[string]": "unknown" }),
});

// ── CharacterCard ──

export const CharacterCard = CharacterCardV2.or(CharacterCardV3);

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
