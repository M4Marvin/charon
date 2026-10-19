import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { CharacterDataV2 } from "@/lib/st-core/character";
import type { LoreConfig, LoreEntry as LoreEntryData } from "@/lib/st-core/lorebook";

// ── Auth tables (better-auth) ────────────────────────────────────────────────
// Shape matches better-auth's drizzle adapter expectations. Table names and
// column names are what the adapter looks up when handling auth requests.

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  username: text("username").notNull().unique(),
  displayUsername: text("display_username"),
  role: text("role").notNull().default("user"),
  banned: integer("banned", { mode: "boolean" }).notNull().default(false),
  banReason: text("ban_reason"),
  banExpires: integer("ban_expires", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  impersonatedBy: text("impersonated_by"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp_ms",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp_ms",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Domain tables (single-user) ──────────────────────────────────────────────

export const characters = sqliteTable(
  "characters",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    data: text("data", { mode: "json" }).$type<CharacterDataV2>().notNull(),
    spec: text("spec").notNull().default("chara_card_v2"),
    specVersion: text("spec_version").notNull().default("2.0"),
    imagePath: text("image_path"),
    tagline: text("tagline"),
    creator: text("creator").notNull().default(""),
    creatorNotes: text("creator_notes").notNull().default(""),
    tags: text("tags", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("characters_updated_idx").on(table.updatedAt),
    index("characters_name_idx").on(table.name),
  ],
);

export const lorebooks = sqliteTable("lorebooks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  config: text("config", { mode: "json" }).$type<LoreConfig>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  enabled: integer("enabled").notNull().default(0),
});

export const loreEntries = sqliteTable(
  "lore_entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    lorebookId: text("lorebook_id")
      .notNull()
      .references(() => lorebooks.id, { onDelete: "cascade" }),
    uid: integer("uid").notNull(),
    data: text("data", { mode: "json" }).$type<LoreEntryData>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    userDisabled: integer("user_disabled").notNull().default(0),
  },
  (table) => [
    index("lore_entries_lorebook_id_idx").on(table.lorebookId),
    uniqueIndex("lore_entries_lorebook_uid_uq").on(table.lorebookId, table.uid),
  ],
);

export const chats = sqliteTable(
  "chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    backgroundId: text("background_id").references(() => backgrounds.id, { onDelete: "set null" }),
    characterDescription: text("character_description").notNull().default(""),
    characterPersonality: text("character_personality").notNull().default(""),
    characterScenario: text("character_scenario").notNull().default(""),
    characterSystemPrompt: text("character_system_prompt").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("chats_character_id_idx").on(table.characterId)],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    localId: integer("local_id").notNull(),
    parentLocalId: integer("parent_local_id"),
    children: text("children", { mode: "json" })
      .$type<number[]>()
      .notNull()
      .default(sql`'[]'`),
    selectedChildLocalId: integer("selected_child_local_id"),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    content: text("content").notNull(),
    extra: text("extra", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.localId] }),
    index("chat_messages_chat_id_idx").on(table.chatId),
  ],
);

export const backgrounds = sqliteTable("backgrounds", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  path: text("path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const aiProviders = sqliteTable(
  "ai_providers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    baseUrl: text("base_url").notNull(),
    apiKey: text("api_key").notNull(),
    defaultModel: text("default_model"),
    defaultHeaders: text("default_headers", { mode: "json" }).$type<Record<string, string>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("ai_providers_name_uq").on(table.name)],
);

export const presets = sqliteTable(
  "presets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    providerId: text("provider_id").references(() => aiProviders.id, {
      onDelete: "set null",
    }),
    model: text("model"),
    data: text("data", { mode: "json" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("presets_provider_id_idx").on(table.providerId),
    uniqueIndex("presets_name_uq").on(table.name),
  ],
);

export const personas = sqliteTable("personas", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  iconPath: text("icon_path"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Account settings row; stores AI defaults to seed new chats plus prompt
// overrides. Upserted on first use. All new columns nullable so partial
// settings work — a user can fill in just the system prompt and leave the
// rest blank.
export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  defaultProviderId: text("default_provider_id").references(() => aiProviders.id, {
    onDelete: "set null",
  }),
  defaultPresetId: text("default_preset_id").references(() => presets.id, {
    onDelete: "set null",
  }),
  defaultSelectedModel: text("default_selected_model"),
  defaultPersonaId: text("default_persona_id").references(() => personas.id, {
    onDelete: "set null",
  }),
  systemPrompt: text("system_prompt"),
  postHistoryInstructions: text("post_history_instructions"),
  impersonationPrompt: text("impersonation_prompt"),
  imagePromptExample: text("image_prompt_example"),
  onboardingCompletedAt: integer("onboarding_completed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Generation engine ────────────────────────────────────────────────────────

export const generationJobs = sqliteTable(
  "generation_jobs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    requestId: text("request_id").notNull(),
    chatId: text("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
    trigger: text("trigger", { enum: ["send", "regenerate", "continue", "impersonate", "image", "rewrite", "transform"] }).notNull(),
    promptMode: text("prompt_mode", { enum: ["chat", "impersonate", "image", "rewrite", "transform"] }).notNull(),
    status: text("status", { enum: ["queued", "running", "finalizing", "succeeded", "failed", "cancelled", "expired"] }).notNull().default("queued"),
    baseLeafId: integer("base_leaf_id"),
    target: text("target", { mode: "json" }).$type<Record<string, unknown>>(),
    input: text("input", { mode: "json" }).$type<Record<string, unknown>>(),
    placeholderLocalId: integer("placeholder_local_id"),
    leaseOwner: text("lease_owner"),
    leaseEpoch: integer("lease_epoch").notNull().default(0),
    leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp_ms" }),
    attempt: integer("attempt").notNull().default(0),
    requiresConfirmation: integer("requires_confirmation", { mode: "boolean" }).notNull().default(false),
    result: text("result", { mode: "json" }).$type<Record<string, unknown>>(),
    error: text("error", { mode: "json" }).$type<Record<string, unknown>>(),
    usage: text("usage", { mode: "json" }).$type<Record<string, unknown>>(),
    finishReason: text("finish_reason"),
    draftText: text("draft_text"),
    chunkSeq: integer("chunk_seq").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("generation_jobs_request_id_uq").on(table.requestId),
    index("generation_jobs_chat_status_idx").on(table.chatId, table.status),
    index("generation_jobs_created_at_idx").on(table.createdAt),
  ],
);

export const generationProposals = sqliteTable(
  "generation_proposals",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    jobId: text("job_id").notNull().references(() => generationJobs.id, { onDelete: "cascade" }),
    chatId: text("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["rewrite", "transform", "impersonate", "image"] }).notNull(),
    status: text("status", { enum: ["pending", "accepted", "rejected", "superseded"] }).notNull().default("pending"),
    targetLocalId: integer("target_local_id"),
    baseRev: integer("base_rev"),
    baseHash: text("base_hash"),
    proposedContent: text("proposed_content").notNull(),
    proposedRole: text("proposed_role", { enum: ["user", "assistant"] }),
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("generation_proposals_chat_idx").on(table.chatId, table.status),
    index("generation_proposals_job_idx").on(table.jobId),
  ],
);

export const chatMessageRevisions = sqliteTable(
  "chat_message_revisions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    chatId: text("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
    messageLocalId: integer("message_local_id").notNull(),
    rev: integer("rev").notNull(),
    content: text("content").notNull(),
    source: text("source", { enum: ["edit", "rewrite", "undo"] }).notNull(),
    jobId: text("job_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("chat_message_revisions_uq").on(table.chatId, table.messageLocalId, table.rev),
    index("chat_message_revisions_chat_idx").on(table.chatId),
  ],
);

// ── TanStack AI persistence (server-authoritative persistence: true) ─────────

export const aiChatThreads = sqliteTable("ai_chat_threads", {
  threadId: text("thread_id").primaryKey(),
  messages: text("messages", { mode: "json" }).$type<unknown[]>().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const aiRuns = sqliteTable(
  "ai_runs",
  {
    runId: text("run_id").primaryKey(),
    threadId: text("thread_id").notNull(),
    parentRunId: text("parent_run_id"),
    subagentRunId: text("subagent_run_id"),
    name: text("name"),
    status: text("status", { enum: ["running", "interrupted", "completed", "failed", "aborted"] }).notNull().default("running"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    error: text("error", { mode: "json" }).$type<Record<string, unknown>>(),
    usage: text("usage", { mode: "json" }).$type<Record<string, unknown>>(),
    detachedSince: integer("detached_since", { mode: "timestamp_ms" }),
    cancelRequested: integer("cancel_requested", { mode: "boolean" }).notNull().default(false),
    driverEpoch: integer("driver_epoch"),
  },
  (table) => [
    index("ai_runs_thread_idx").on(table.threadId, table.startedAt),
  ],
);

export const aiInterrupts = sqliteTable(
  "ai_interrupts",
  {
    interruptId: text("interrupt_id").primaryKey(),
    runId: text("run_id").notNull(),
    threadId: text("thread_id").notNull(),
    status: text("status", { enum: ["pending", "resolved", "cancelled"] }).notNull().default("pending"),
    requestedAt: integer("requested_at", { mode: "timestamp_ms" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    response: text("response", { mode: "json" }).$type<unknown>(),
  },
  (table) => [
    index("ai_interrupts_thread_idx").on(table.threadId, table.requestedAt),
    index("ai_interrupts_run_idx").on(table.runId, table.requestedAt),
  ],
);

export const aiMetadata = sqliteTable(
  "ai_metadata",
  {
    namespace: text("namespace").notNull(),
    key: text("key").notNull(),
    value: text("value", { mode: "json" }).$type<unknown>(),
    revision: integer("revision").notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.namespace, table.key] })],
);

// ── Relations ────────────────────────────────────────────────────────────────
// Optional but useful for typed `with: { ... }` joins. Kept minimal here.

export const usersRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  settings: one(userSettings, { fields: [user.id], references: [userSettings.userId] }),
}));

export const sessionsRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountsRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const charactersRelations = relations(characters, ({ many }) => ({
  chats: many(chats),
}));

export const lorebooksRelations = relations(lorebooks, ({ many }) => ({
  entries: many(loreEntries),
}));

export const loreEntriesRelations = relations(loreEntries, ({ one }) => ({
  lorebook: one(lorebooks, {
    fields: [loreEntries.lorebookId],
    references: [lorebooks.id],
  }),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  character: one(characters, {
    fields: [chats.characterId],
    references: [characters.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  chat: one(chats, {
    fields: [chatMessages.chatId],
    references: [chats.id],
  }),
}));

export const presetsRelations = relations(presets, ({ one }) => ({
  provider: one(aiProviders, {
    fields: [presets.providerId],
    references: [aiProviders.id],
  }),
}));

export const aiProvidersRelations = relations(aiProviders, ({ many }) => ({
  presets: many(presets),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(user, { fields: [userSettings.userId], references: [user.id] }),
  defaultPersona: one(personas, {
    fields: [userSettings.defaultPersonaId],
    references: [personas.id],
  }),
}));

// ── Inferred types ──────────────────────────────────────────────────────────
// Re-exported as the canonical row types. Use these in repos / server fns.

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
export type Lorebook = typeof lorebooks.$inferSelect;
export type NewLorebook = typeof lorebooks.$inferInsert;
export type LoreEntry = typeof loreEntries.$inferSelect;
export type NewLoreEntry = typeof loreEntries.$inferInsert;
export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type NewChatMessageRow = typeof chatMessages.$inferInsert;
export type Preset = typeof presets.$inferSelect;
export type NewPreset = typeof presets.$inferInsert;
export type Persona = typeof personas.$inferSelect;
export type NewPersona = typeof personas.$inferInsert;
export type AiProvider = typeof aiProviders.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type NewAiProvider = typeof aiProviders.$inferInsert;
export type Background = typeof backgrounds.$inferSelect;
export type NewBackground = typeof backgrounds.$inferInsert;

export type GenerationJob = typeof generationJobs.$inferSelect;
export type NewGenerationJob = typeof generationJobs.$inferInsert;
export type GenerationProposal = typeof generationProposals.$inferSelect;
export type NewGenerationProposal = typeof generationProposals.$inferInsert;
export type ChatMessageRevision = typeof chatMessageRevisions.$inferSelect;
export type NewChatMessageRevision = typeof chatMessageRevisions.$inferInsert;
export type AiChatThread = typeof aiChatThreads.$inferSelect;
export type AiRun = typeof aiRuns.$inferSelect;
export type AiInterrupt = typeof aiInterrupts.$inferSelect;
export type AiMetadata = typeof aiMetadata.$inferSelect;

