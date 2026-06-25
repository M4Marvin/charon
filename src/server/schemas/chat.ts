import { Schema } from "effect";

// ── Shared atoms ─────────────────────────────────────────────────────────────

const ChatId = Schema.Struct({ id: Schema.String });

const ChatIdAndLocalId = Schema.Struct({
  chatId: Schema.String,
  messageLocalId: Schema.Number,
});

// "absent (undefined) = leave alone, null = clear, string = set"
// Encoded: string | null | undefined. The repo's partial-patch guard
// (`!== undefined`) does the right thing automatically.
const NullableOptionalString = Schema.UndefinedOr(Schema.NullOr(Schema.String));

// ── Chat CRUD ───────────────────────────────────────────────────────────────

export const GetChat = ChatId;
export const GetChatMessages = ChatId;
export const DeleteChat = ChatId;

export const CreateChat = Schema.Struct({ characterId: Schema.String });

// ── Chat messages ───────────────────────────────────────────────────────────

export const SendMessage = Schema.Struct({
  chatId: Schema.String,
  content: Schema.String,
});

export const Swipe = Schema.Struct({
  chatId: Schema.String,
  messageLocalId: Schema.Number,
  direction: Schema.Literal("next", "prev"),
});

export const DeleteMessageBranch = ChatIdAndLocalId;

export const EditMessage = Schema.Struct({
  chatId: Schema.String,
  messageLocalId: Schema.Number,
  content: Schema.String,
});

// ── Streaming ───────────────────────────────────────────────────────────────

export const PrepareStream = Schema.Struct({
  chatId: Schema.String,
  mode: Schema.Literal("send", "regenerate", "continue"),
  content: Schema.optional(Schema.String),
  messageLocalId: Schema.optional(Schema.Number),
});

export const FinalizeStream = Schema.Struct({
  chatId: Schema.String,
  messageLocalId: Schema.Number,
  content: Schema.String,
});

export const CancelStream = ChatIdAndLocalId;

// ── Impersonation ────────────────────────────────────────────────────────────

export const ImpersonateMessage = Schema.Struct({
  chatId: Schema.String,
});

// ── Settings ────────────────────────────────────────────────────────────────

export const UpdateChatSettings = Schema.Struct({
  id: Schema.String,
  providerId: NullableOptionalString,
  presetId: NullableOptionalString,
  selectedModel: NullableOptionalString,
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
