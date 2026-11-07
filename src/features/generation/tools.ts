import { Context, Effect, Layer, Schema } from "effect";
import { toolDefinition } from "@tanstack/ai";
import * as AI from "@tanstack/ai-effect";
import { GenerationValidationError } from "./errors";
import { db as defaultDb, type DB } from "@/db";
import { getChat, getMessages } from "@/features/chat/tree/service";
import { loadChatConfig } from "@/features/chat/config/service";
import { getEnabledLoreEntries } from "@/features/chat/config/lorebook";
import type { LoreEntry } from "@/lib/st-core/lorebook/types";
import type { ChatMessage } from "@/lib/st-core/shared/types";
import type { CharacterDataV2 } from "@/lib/st-core/character/types";
import type { ChatDetail } from "@/features/chat/tree/types";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getActiveLeafId } from "@/lib/st-core/chat-tree/tree";
import { getPathToNode } from "@/features/chat/tree/active-path";

// ── Caps ────────────────────────────────────────────────────────────────────
// Tools are model-facing, so every result is bounded independently of the
// database row size. These constants are exported for tests and prompt docs.

export const LORE_RESULT_DEFAULT = 5;
export const LORE_RESULT_MAX = 20;
export const LORE_CONTENT_CAP = 2_000;
export const LORE_KEY_CAP = 120;
export const LORE_KEYS_MAX = 24;
export const LORE_QUERY_CAP = 500;

export const SCENE_MESSAGE_DEFAULT = 12;
export const SCENE_MESSAGE_MAX = 50;
export const SCENE_CONTENT_CAP = 4_000;

export const CHARACTER_TEXT_CAP = 4_000;
export const CHARACTER_NAME_CAP = 200;
export const CHARACTER_TAGS_MAX = 50;
export const CHARACTER_TAG_CAP = 100;

// ── Pure helpers ────────────────────────────────────────────────────────────

export type CharacterField =
  | "name"
  | "description"
  | "personality"
  | "scenario"
  | "systemPrompt"
  | "tags";

export const CHARACTER_FIELDS = [
  "name",
  "description",
  "personality",
  "scenario",
  "systemPrompt",
  "tags",
] as const satisfies readonly CharacterField[];

export interface CharacterView {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  systemPrompt?: string;
  tags?: string[];
}

/** Minimal config shape needed to project a character view. */
export interface CharacterConfigView {
  chat: Pick<
    ChatDetail,
    "characterDescription" | "characterPersonality" | "characterScenario" | "characterSystemPrompt"
  >;
  character: CharacterDataV2;
}

export interface LoreResultEntry {
  id: number;
  keys: string[];
  content: string;
}

export interface SceneMessage {
  localId: number;
  role: "user" | "assistant" | "system";
  content: string;
}

/** Truncate to at most `cap` characters, including the ellipsis marker. */
export function capText(value: string, cap: number): string {
  if (value.length <= cap) return value;
  return `${value.slice(0, Math.max(0, cap - 1))}…`;
}

/** Clamp a model-provided limit into [1, max], falling back when absent/invalid. */
export function clampLimit(
  value: number | null | undefined,
  fallback: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.floor(value), 1), max);
}

/** Split a free-text query into lowercase, de-duplicated search terms. */
export function normalizeQueryTerms(query: string): string[] {
  const terms = query
    .slice(0, LORE_QUERY_CAP)
    .toLowerCase()
    .split(/[\s,]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
  return [...new Set(terms)];
}

function entryKeys(entry: LoreEntry): string[] {
  return [
    ...new Set(
      [...entry.key, ...entry.keysecondary]
        .map((key) => key.trim())
        .filter((key) => key.length > 0),
    ),
  ];
}

/**
 * Keyword-filter enabled lore entries. Key hits rank above content/comment
 * hits; ties fall back to the entry's configured order and uid. Results are
 * capped in both count and content size.
 */
export function filterLoreEntries(
  entries: readonly LoreEntry[],
  query: string,
  limit: number = LORE_RESULT_DEFAULT,
): LoreResultEntry[] {
  const terms = normalizeQueryTerms(query);
  if (terms.length === 0) return [];

  const scored: Array<{ entry: LoreEntry; score: number }> = [];
  for (const entry of entries) {
    const keys = entryKeys(entry);
    const keyText = keys.join("\n").toLowerCase();
    const bodyText = `${entry.comment}\n${entry.content}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (keyText.includes(term)) score += 2;
      else if (bodyText.includes(term)) score += 1;
    }
    if (score > 0) scored.push({ entry, score });
  }

  scored.sort(
    (a, b) => b.score - a.score || a.entry.order - b.entry.order || a.entry.uid - b.entry.uid,
  );

  const capped = clampLimit(limit, LORE_RESULT_DEFAULT, LORE_RESULT_MAX);
  return scored.slice(0, capped).map(({ entry }) => ({
    id: entry.uid,
    keys: entryKeys(entry)
      .slice(0, LORE_KEYS_MAX)
      .map((key) => capText(key, LORE_KEY_CAP)),
    content: capText(entry.content.trim(), LORE_CONTENT_CAP),
  }));
}

/**
 * Project the active chat's character config into the six tool fields. Chat
 * rows carry per-chat overrides; an empty override falls back to the card.
 */
export function buildCharacterView(
  config: CharacterConfigView,
  fields?: readonly CharacterField[],
): CharacterView {
  const { chat, character } = config;
  const view: Required<CharacterView> = {
    name: capText(character.name, CHARACTER_NAME_CAP),
    description: capText(chat.characterDescription || character.description, CHARACTER_TEXT_CAP),
    personality: capText(chat.characterPersonality || character.personality, CHARACTER_TEXT_CAP),
    scenario: capText(chat.characterScenario || character.scenario, CHARACTER_TEXT_CAP),
    systemPrompt: capText(
      chat.characterSystemPrompt || character.system_prompt,
      CHARACTER_TEXT_CAP,
    ),
    tags: (character.tags ?? [])
      .slice(0, CHARACTER_TAGS_MAX)
      .map((tag) => capText(tag, CHARACTER_TAG_CAP)),
  };

  // No selector (or an empty selector) means "all fields".
  if (!fields || fields.length === 0) return view;

  const selected = new Set(fields);
  return {
    ...(selected.has("name") ? { name: view.name } : {}),
    ...(selected.has("description") ? { description: view.description } : {}),
    ...(selected.has("personality") ? { personality: view.personality } : {}),
    ...(selected.has("scenario") ? { scenario: view.scenario } : {}),
    ...(selected.has("systemPrompt") ? { systemPrompt: view.systemPrompt } : {}),
    ...(selected.has("tags") ? { tags: view.tags } : {}),
  };
}

/**
 * Read the active branch's recent messages, oldest first. The hidden root
 * (localId 0) and empty system placeholders are omitted, matching the prompt
 * assembly path. Message content is capped individually.
 */
export function buildScene(messages: readonly ChatMessage[], limit?: number): SceneMessage[] {
  if (messages.length === 0) return [];

  const tree = treeFromNodes([...messages]);
  const activeLeafId = getActiveLeafId(tree);
  if (activeLeafId === null) return [];

  const path = getPathToNode(tree, activeLeafId)
    .filter((message) => message.localId !== 0)
    .filter((message) => !(message.role === "system" && message.content.trim().length === 0));

  const capped = clampLimit(limit, SCENE_MESSAGE_DEFAULT, SCENE_MESSAGE_MAX);
  return path.slice(-capped).map((message) => ({
    localId: message.localId,
    role: message.role,
    content: capText(message.content, SCENE_CONTENT_CAP),
  }));
}

// ── Schemas ─────────────────────────────────────────────────────────────────

const ReadLoreInput = Schema.Struct({
  query: Schema.String,
  limit: Schema.optionalKey(Schema.Int),
});

const LoreResultEntrySchema = Schema.Struct({
  id: Schema.Number,
  keys: Schema.Array(Schema.String),
  content: Schema.String,
});

const ReadLoreOutput = Schema.Struct({
  entries: Schema.Array(LoreResultEntrySchema),
});

const CharacterViewSchema = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  personality: Schema.optionalKey(Schema.String),
  scenario: Schema.optionalKey(Schema.String),
  systemPrompt: Schema.optionalKey(Schema.String),
  tags: Schema.optionalKey(Schema.Array(Schema.String)),
});

const ReadCharacterInput = Schema.Struct({
  fields: Schema.optionalKey(Schema.Array(Schema.Literals(CHARACTER_FIELDS))),
});

const SceneMessageSchema = Schema.Struct({
  localId: Schema.Number,
  role: Schema.Literals(["user", "assistant", "system"]),
  content: Schema.String,
});

const ReadSceneInput = Schema.Struct({
  limit: Schema.optionalKey(Schema.Int),
});

const ReadSceneOutput = Schema.Struct({
  messages: Schema.Array(SceneMessageSchema),
});

// ── Tool definitions ────────────────────────────────────────────────────────

// AI.toolSchema closes every object (`additionalProperties: false`), which is
// what lets OpenAI run these tools in strict mode. Schema.toStandardJSONSchemaV1
// leaves objects open and silently downgrades the tool to strict: false.
export const readLoreDefinition = toolDefinition({
  name: "read_lore",
  description:
    "Search enabled lorebook entries by keyword. Matches entry keys, secondary keys, comments, and content. Returns at most `limit` entries (default 5, max 20), each with its uid, matched keys, and content capped at 2,000 characters. Read-only.",
  inputSchema: AI.toolSchema(ReadLoreInput),
  outputSchema: AI.toolSchema(ReadLoreOutput),
});

export const readCharacterDefinition = toolDefinition({
  name: "read_character",
  description:
    "Read the active chat's character card: name, description, personality, scenario, system prompt, and tags. Per-chat overrides win over card fields. Pass `fields` to select a subset; omit it for all fields. Read-only.",
  inputSchema: AI.toolSchema(ReadCharacterInput),
  outputSchema: AI.toolSchema(CharacterViewSchema),
});

export const readSceneDefinition = toolDefinition({
  name: "read_scene",
  description:
    "Read recent messages from the chat's active branch, oldest first, excluding the hidden root. Returns at most `limit` messages (default 12, max 50) with content capped at 4,000 characters each. Read-only.",
  inputSchema: AI.toolSchema(ReadSceneInput),
  outputSchema: AI.toolSchema(ReadSceneOutput),
});

// ── Effect runtime ──────────────────────────────────────────────────────────

/**
 * Per-request services for the read tools. The route/proposal builds this with
 * the request's DB, user, and chat; `AI.chat` provides the Layer to the stream.
 */
export class ReadToolRuntime extends Context.Service<
  ReadToolRuntime,
  {
    readonly db: DB;
    readonly userId: string;
    readonly chatId: string;
  }
>()("ReadToolRuntime") {}

export function makeReadToolLayer(input: {
  db?: DB;
  userId: string;
  chatId: string;
}): Layer.Layer<ReadToolRuntime> {
  return Layer.succeed(ReadToolRuntime, {
    db: input.db ?? defaultDb,
    userId: input.userId,
    chatId: input.chatId,
  });
}

function decodeToolInput<S extends Schema.ConstraintDecoder<unknown, never>>(
  schema: S,
  value: unknown,
  toolName: string,
): Effect.Effect<S["Type"], GenerationValidationError> {
  return Effect.try({
    try: () => Schema.decodeUnknownSync(schema)(value) as S["Type"],
    catch: (cause) =>
      new GenerationValidationError({
        message: `Invalid ${toolName} arguments: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      }),
  });
}

function requireChat(runtime: {
  readonly db: DB;
  readonly chatId: string;
}): Effect.Effect<void, GenerationValidationError> {
  return Effect.try({
    try: () => getChat(runtime.chatId, runtime.db),
    catch: () =>
      new GenerationValidationError({
        message: `Chat not found: ${runtime.chatId}`,
        field: "chatId",
      }),
  }).pipe(Effect.asVoid);
}

/**
 * Read-only server tools as Effects. Each tool reads `ReadToolRuntime`, so the
 * route/proposal supplies the request context and DB as a Layer. A tool failure
 * is returned to the model as a tool error and does not fail the run.
 */
export const readLore = AI.serverTool(readLoreDefinition, (args) =>
  Effect.gen(function* () {
    const runtime = yield* ReadToolRuntime;
    const input = yield* decodeToolInput(ReadLoreInput, args, "read_lore");
    if (input.query.trim().length === 0) {
      return yield* Effect.fail(
        new GenerationValidationError({
          message: "read_lore requires a non-empty query.",
          field: "query",
        }),
      );
    }
    yield* requireChat(runtime);
    return {
      entries: filterLoreEntries(getEnabledLoreEntries(runtime.db), input.query, input.limit),
    };
  }),
);

export const readCharacter = AI.serverTool(readCharacterDefinition, (args) =>
  Effect.gen(function* () {
    const runtime = yield* ReadToolRuntime;
    const input = yield* decodeToolInput(ReadCharacterInput, args, "read_character");
    yield* requireChat(runtime);
    const config = yield* Effect.tryPromise({
      try: () => loadChatConfig(runtime.userId, runtime.chatId, "User", runtime.db),
      catch: (cause) =>
        new GenerationValidationError({
          message: cause instanceof Error ? cause.message : String(cause),
        }),
    });
    return buildCharacterView(config, input.fields);
  }),
);

export const readScene = AI.serverTool(readSceneDefinition, (args) =>
  Effect.gen(function* () {
    const runtime = yield* ReadToolRuntime;
    const input = yield* decodeToolInput(ReadSceneInput, args, "read_scene");
    yield* requireChat(runtime);
    return {
      messages: buildScene(getMessages(runtime.chatId, runtime.db), input.limit),
    };
  }),
);

/** Array form for passing directly to `AI.chat({ tools })`. */
export const readTools = [readLore, readCharacter, readScene] as const;
