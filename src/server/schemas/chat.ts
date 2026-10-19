import { Schema } from "effect";

// ── Shared atoms ─────────────────────────────────────────────────────────────

const ChatId = Schema.Struct({ id: Schema.String });

// "absent (undefined) = leave alone, null = clear, string = set"
// Encoded: string | null | undefined. The repo's partial-patch guard
// (`!== undefined`) does the right thing automatically.
//
// `Schema.optional` is required here: `Schema.UndefinedOr` widens the value
// type but Effect structs still require the key. Without it every partial
// settings patch fails with "Missing key at [...]".
const NullableOptionalString = Schema.optional(Schema.NullOr(Schema.String));

// ── Chat CRUD ───────────────────────────────────────────────────────────────

export const GetChat = ChatId;
export const GetChatMessages = ChatId;
export const DeleteChat = ChatId;

export const CreateChat = Schema.Struct({ characterId: Schema.String });

// ── Settings ────────────────────────────────────────────────────────────────

export const UpdateChatSettings = Schema.Struct({
  id: Schema.String,
  title: NullableOptionalString,
  characterDescription: NullableOptionalString,
  characterPersonality: NullableOptionalString,
  characterScenario: NullableOptionalString,
  characterSystemPrompt: NullableOptionalString,
  backgroundId: NullableOptionalString,
});

export const UpdateUserSettings = Schema.Struct({
  defaultProviderId: NullableOptionalString,
  defaultPresetId: NullableOptionalString,
  defaultSelectedModel: NullableOptionalString,
  defaultPersonaId: NullableOptionalString,
  systemPrompt: NullableOptionalString,
  postHistoryInstructions: NullableOptionalString,
  impersonationPrompt: NullableOptionalString,
});
