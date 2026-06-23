// ── V2 Character Card Spec ──
// Spec: https://github.com/malfoyslastname/character-card-spec-v2

export interface CharacterCardV2 {
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: CharacterDataV2;
}

export interface CharacterCardV3 {
  spec: "chara_card_v3";
  spec_version: string;
  data: Record<string, unknown>;
}

export type CharacterCard = CharacterCardV2 | CharacterCardV3;

export interface CharacterDataV2 {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  character_book?: CharacterBook;
  tags: string[];
  creator: string;
  character_version: string;
  extensions: CharacterExtensions;
}

export interface CharacterExtensions {
  talkativeness?: number;
  fav?: boolean | string;
  world?: string;
  depth_prompt?: DepthPrompt;
  [key: string]: unknown;
}

export interface DepthPrompt {
  prompt: string;
  depth: number;
  role: "system" | "user" | "assistant";
}

export interface CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions: Record<string, unknown>;
  entries: CharacterBookEntry[];
}

export interface CharacterBookEntry {
  id?: number;
  keys: string[];
  secondary_keys?: string[];
  comment?: string;
  content: string;
  constant?: boolean;
  selective?: boolean;
  insertion_order: number;
  enabled?: boolean;
  position?: "before_char" | "after_char";
  case_sensitive?: boolean;
  name?: string;
  priority?: number;
  extensions?: CharacterBookEntryExtensions;
}

export interface CharacterBookEntryExtensions {
  position?: number;
  exclude_recursion?: boolean;
  probability?: number;
  useProbability?: boolean;
  depth?: number;
  selectiveLogic?: number;
  group?: string;
  group_override?: boolean;
  group_weight?: number;
  prevent_recursion?: boolean;
  delay_until_recursion?: boolean;
  scan_depth?: number | null;
  match_whole_words?: boolean | null;
  use_group_scoring?: boolean | null;
  case_sensitive?: boolean | null;
  automation_id?: string;
  role?: number;
  vectorized?: boolean;
  display_index?: number;
  sticky?: number | null;
  cooldown?: number | null;
  delay?: number | null;
  match_persona_description?: boolean;
  match_character_description?: boolean;
  match_character_personality?: boolean;
  match_character_depth_prompt?: boolean;
  match_scenario?: boolean;
  match_creator_notes?: boolean;
  triggers?: string[];
  ignore_budget?: boolean;
  [key: string]: unknown;
}

// ── V1 Character Card (legacy) ──

export interface CharacterCardV1 {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creatorcomment?: string;
  tags?: string[];
  talkativeness?: number;
  fav?: boolean | string;
  create_date?: string;
  chat?: string;
  avatar?: string;
  json_data?: string;
  data?: CharacterDataV2;
  spec?: string;
  spec_version?: string;
  [key: string]: unknown;
}

// ── Converted character (flattened V2 -> V1 compat) ──

export interface FlattenedCharacter {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creatorcomment: string;
  avatar: string;
  chat: string;
  talkativeness: number;
  fav: boolean;
  tags: string[];
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: CharacterDataV2;
  create_date?: string;
  creator?: string;
  character_version?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  character_book?: CharacterBook;
  depth_prompt_prompt?: string;
  depth_prompt_depth?: number;
  depth_prompt_role?: string;
  extensions?: Record<string, unknown>;
}

// ── Validation ──

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  spec: number | false;
  errors: ValidationError[];
}
