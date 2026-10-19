import { Schema } from "effect";
import { toolDefinition } from "@tanstack/ai";
import { GenerationValidationError } from "./errors";
import type { ToolContext } from "./contract";
import type { DB } from "@/db";
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

const OkOutput = Schema.Struct({ ok: Schema.Boolean });

const HighlightMessagesInput = Schema.Struct({
  localIds: Schema.Array(Schema.Int),
});

const ScrollToMessageInput = Schema.Struct({
  localId: Schema.Int,
});

const OpenProposalInput = Schema.Struct({
  proposalId: Schema.String,
});

const decodeReadLoreInput = Schema.decodeUnknownSync(ReadLoreInput);
const decodeReadCharacterInput = Schema.decodeUnknownSync(ReadCharacterInput);
const decodeReadSceneInput = Schema.decodeUnknownSync(ReadSceneInput);

// ── Tool definitions ────────────────────────────────────────────────────────

export const readLoreDefinition = toolDefinition({
  name: "read_lore",
  description:
    "Search enabled lorebook entries by keyword. Matches entry keys, secondary keys, comments, and content. Returns at most `limit` entries (default 5, max 20), each with its uid, matched keys, and content capped at 2,000 characters. Read-only.",
  inputSchema: Schema.toStandardJSONSchemaV1(ReadLoreInput),
  outputSchema: Schema.toStandardJSONSchemaV1(ReadLoreOutput),
});

export const readCharacterDefinition = toolDefinition({
  name: "read_character",
  description:
    "Read the active chat's character card: name, description, personality, scenario, system prompt, and tags. Per-chat overrides win over card fields. Pass `fields` to select a subset; omit it for all fields. Read-only.",
  inputSchema: Schema.toStandardJSONSchemaV1(ReadCharacterInput),
  outputSchema: Schema.toStandardJSONSchemaV1(CharacterViewSchema),
});

export const readSceneDefinition = toolDefinition({
  name: "read_scene",
  description:
    "Read recent messages from the chat's active branch, oldest first, excluding the hidden root. Returns at most `limit` messages (default 12, max 50) with content capped at 4,000 characters each. Read-only.",
  inputSchema: Schema.toStandardJSONSchemaV1(ReadSceneInput),
  outputSchema: Schema.toStandardJSONSchemaV1(ReadSceneOutput),
});

export const highlightMessagesDefinition = toolDefinition({
  name: "highlight_messages",
  description:
    "Highlight one or more messages in the chat UI. Client-side only; does not modify the conversation.",
  inputSchema: Schema.toStandardJSONSchemaV1(HighlightMessagesInput),
  outputSchema: Schema.toStandardJSONSchemaV1(OkOutput),
});

export const scrollToMessageDefinition = toolDefinition({
  name: "scroll_to_message",
  description:
    "Scroll the chat view to a specific message. Client-side only; does not modify the conversation.",
  inputSchema: Schema.toStandardJSONSchemaV1(ScrollToMessageInput),
  outputSchema: Schema.toStandardJSONSchemaV1(OkOutput),
});

export const openProposalDefinition = toolDefinition({
  name: "open_proposal",
  description:
    "Open a pending generation proposal in the UI. Client-side only; accepting or rejecting is left to the user.",
  inputSchema: Schema.toStandardJSONSchemaV1(OpenProposalInput),
  outputSchema: Schema.toStandardJSONSchemaV1(OkOutput),
});

export const clientToolDefinitions = [
  highlightMessagesDefinition,
  scrollToMessageDefinition,
  openProposalDefinition,
] as const;

// ── Server runtime ──────────────────────────────────────────────────────────

export interface ReadToolDeps {
  /** Database handle. Defaults to the app singleton via a lazy import. */
  readonly db?: DB;
  /** Persona fallback passed through to loadChatConfig. Unused by the tools. */
  readonly fallbackUserName?: string;
}

interface ServerModules {
  readonly db: DB;
  readonly getChat: typeof import("@/features/chat/tree/service").getChat;
  readonly getMessages: typeof import("@/features/chat/tree/service").getMessages;
  readonly loadChatConfig: typeof import("@/features/chat/config/service").loadChatConfig;
  readonly getEnabledLoreEntries: typeof import("@/features/chat/config/lorebook").getEnabledLoreEntries;
}

let modulesPromise: Promise<ServerModules> | undefined;

/**
 * Server modules are loaded lazily so this file stays importable from the
 * client for the shared tool definitions (useChat only needs the client
 * versions); the database is never touched until a server tool executes.
 */
function loadServerModules(): Promise<ServerModules> {
  modulesPromise ??= (async () => {
    const [dbModule, treeService, configService, lorebookConfig] = await Promise.all([
      import("@/db"),
      import("@/features/chat/tree/service"),
      import("@/features/chat/config/service"),
      import("@/features/chat/config/lorebook"),
    ]);
    return {
      db: dbModule.db,
      getChat: treeService.getChat,
      getMessages: treeService.getMessages,
      loadChatConfig: configService.loadChatConfig,
      getEnabledLoreEntries: lorebookConfig.getEnabledLoreEntries,
    };
  })();
  return modulesPromise;
}

async function resolveServerModules(deps: ReadToolDeps): Promise<ServerModules> {
  const modules = await loadServerModules();
  if (!deps.db) return modules;
  return { ...modules, db: deps.db };
}

function decodeArgs<T>(decode: (value: unknown) => T, value: unknown, toolName: string): T {
  try {
    return decode(value);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new GenerationValidationError({
      message: `Invalid ${toolName} arguments: ${detail}`,
    });
  }
}

function requireToolContext(
  runtime: { context?: ToolContext } | undefined,
  toolName: string,
): ToolContext {
  const context = runtime?.context;
  if (!context || typeof context.userId !== "string" || context.userId.length === 0) {
    throw new GenerationValidationError({
      message: `${toolName} requires an authenticated user context.`,
      field: "userId",
    });
  }
  if (typeof context.chatId !== "string" || context.chatId.length === 0) {
    throw new GenerationValidationError({
      message: `${toolName} requires a chat context.`,
      field: "chatId",
    });
  }
  return context;
}

function requireChat(chatId: string, db: DB, getChat: ServerModules["getChat"]): ChatDetail {
  try {
    return getChat(chatId, db);
  } catch {
    throw new GenerationValidationError({
      message: `Chat not found: ${chatId}`,
      field: "chatId",
    });
  }
}

/**
 * Build the read-only server tools bound to a runtime context. Every tool:
 * - decodes its arguments with the same Effect schema advertised to the
 *   model,
 * - validates that the runtime chat exists,
 * - only reads from the database.
 */
export function createReadTools(deps: ReadToolDeps = {}) {
  const readLore = readLoreDefinition.server<ToolContext>(async (args, runtime) => {
    const context = requireToolContext(runtime, "read_lore");
    const input = decodeArgs(decodeReadLoreInput, args, "read_lore");
    if (input.query.trim().length === 0) {
      throw new GenerationValidationError({
        message: "read_lore requires a non-empty query.",
        field: "query",
      });
    }
    const modules = await resolveServerModules(deps);
    requireChat(context.chatId, modules.db, modules.getChat);
    return {
      entries: filterLoreEntries(
        modules.getEnabledLoreEntries(modules.db),
        input.query,
        input.limit,
      ),
    };
  });

  const readCharacter = readCharacterDefinition.server<ToolContext>(async (args, runtime) => {
    const context = requireToolContext(runtime, "read_character");
    const input = decodeArgs(decodeReadCharacterInput, args, "read_character");
    const modules = await resolveServerModules(deps);
    requireChat(context.chatId, modules.db, modules.getChat);
    const config = await modules.loadChatConfig(
      context.userId,
      context.chatId,
      deps.fallbackUserName ?? "User",
      modules.db,
    );
    return buildCharacterView(config, input.fields);
  });

  const readScene = readSceneDefinition.server<ToolContext>(async (args, runtime) => {
    const context = requireToolContext(runtime, "read_scene");
    const input = decodeArgs(decodeReadSceneInput, args, "read_scene");
    const modules = await resolveServerModules(deps);
    requireChat(context.chatId, modules.db, modules.getChat);
    return {
      messages: buildScene(modules.getMessages(context.chatId, modules.db), input.limit),
    };
  });

  return { readLore, readCharacter, readScene } as const;
}

export type ReadTools = ReturnType<typeof createReadTools>;

/** Default-bound server tools, keyed by name (app database). */
export const readToolSet = createReadTools();

/** Array form for passing directly to `chat({ tools })`. */
export const readTools = [
  readToolSet.readLore,
  readToolSet.readCharacter,
  readToolSet.readScene,
] as const;

// ── Client tools ────────────────────────────────────────────────────────────

export interface ClientToolHandlers {
  highlightMessages?: (args: { readonly localIds: readonly number[] }) => void;
  scrollToMessage?: (args: { readonly localId: number }) => void;
  openProposal?: (args: { readonly proposalId: string }) => void;
}

/**
 * Client-side placeholders for the UI tools. They perform no persistence and
 * return `{ ok: true }`; pass handlers from the chat surface to wire them to
 * highlighting/scrolling/proposal UI.
 */
export function createClientTools(handlers: ClientToolHandlers = {}) {
  return [
    highlightMessagesDefinition.client((args) => {
      handlers.highlightMessages?.(args);
      return { ok: true };
    }),
    scrollToMessageDefinition.client((args) => {
      handlers.scrollToMessage?.(args);
      return { ok: true };
    }),
    openProposalDefinition.client((args) => {
      handlers.openProposal?.(args);
      return { ok: true };
    }),
  ] as const;
}

/** Default no-op client tools for useChat. */
export const clientTools = createClientTools();
