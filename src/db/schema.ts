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

// ── Domain tables (user-scoped) ──────────────────────────────────────────────
// All domain tables reference user.id with onDelete: 'cascade'. Belongs-to
// relations cascade too (character → chats, lorebook → entries, chat → messages).

export const characters = sqliteTable(
  "characters",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    data: text("data", { mode: "json" }).$type<CharacterDataV2>().notNull(),
    spec: text("spec").notNull().default("chara_card_v2"),
    specVersion: text("spec_version").notNull().default("2.0"),
    imagePath: text("image_path"),
    tagline: text("tagline"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("characters_user_id_idx").on(table.userId)],
);

export const lorebooks = sqliteTable(
  "lorebooks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    imagePath: text("image_path"),
    config: text("config", { mode: "json" }).$type<LoreConfig>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("lorebooks_user_id_idx").on(table.userId)],
);

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
  },
  (table) => [
    index("lore_entries_lorebook_id_idx").on(table.lorebookId),
    uniqueIndex("lore_entries_lorebook_uid_uq").on(table.lorebookId, table.uid),
  ],
);

// Per-user lorebook activation overlay. Presence = enabled. Opt-in: no row
// means the lorebook is disabled for this user.
export const userLorebookSettings = sqliteTable(
  "user_lorebook_settings",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lorebookId: text("lorebook_id")
      .notNull()
      .references(() => lorebooks.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.lorebookId] }),
    index("user_lorebook_settings_user_id_idx").on(table.userId),
  ],
);

// Per-user entry disable overlay. Presence = user-disabled. AND semantics
// with the entry's own data.disable: entry is active iff !data.disable
// && !userOverlay.
export const userLoreEntrySettings = sqliteTable(
  "user_lore_entry_settings",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    entryId: text("entry_id")
      .notNull()
      .references(() => loreEntries.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.entryId] }),
    index("user_lore_entry_settings_user_id_idx").on(table.userId),
  ],
);

export const chats = sqliteTable(
  "chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    backgroundPath: text("background_path"),
    providerId: text("provider_id").references(() => aiProviders.id, {
      onDelete: "set null",
    }),
    presetId: text("preset_id").references(() => presets.id, {
      onDelete: "set null",
    }),
    selectedModel: text("selected_model"),
    metadata: text("metadata", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("chats_user_id_idx").on(table.userId),
    index("chats_character_id_idx").on(table.characterId),
    index("chats_provider_id_idx").on(table.providerId),
    index("chats_preset_id_idx").on(table.presetId),
  ],
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
    name: text("name"),
    content: text("content").notNull(),
    isUser: integer("is_user", { mode: "boolean" }),
    isSystem: integer("is_system", { mode: "boolean" }),
    extra: text("extra", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.localId] }),
    index("chat_messages_chat_id_idx").on(table.chatId),
  ],
);

export const backgrounds = sqliteTable(
  "backgrounds",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    path: text("path").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
);

export const aiProviders = sqliteTable(
  "ai_providers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" }),
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
  (table) => [
    index("ai_providers_user_id_idx").on(table.userId),
    uniqueIndex("ai_providers_user_name_uq").on(table.userId, table.name),
  ],
);

export const presets = sqliteTable(
  "presets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
    index("presets_user_id_idx").on(table.userId),
    index("presets_provider_id_idx").on(table.providerId),
    uniqueIndex("presets_user_name_uq").on(table.userId, table.name),
  ],
);

export const personas = sqliteTable(
  "personas",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    iconPath: text("icon_path"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("personas_user_id_idx").on(table.userId)],
);

// One row per user; stores the AI defaults to seed new chats with, plus
// per-user prompt overrides. Upserted on first use. All new columns
// nullable so partial settings work — a user can fill in just the system
// prompt and leave the rest blank.
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
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const userDailyUsage = sqliteTable(
  "user_daily_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    day: text("day").notNull(), // "YYYY-MM-DD" UTC
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

// ── Relations ────────────────────────────────────────────────────────────────
// Optional but useful for typed `with: { ... }` joins. Kept minimal here.

export const usersRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  characters: many(characters),
  lorebooks: many(lorebooks),
  chats: many(chats),
  presets: many(presets),
  personas: many(personas),
  settings: one(userSettings, { fields: [user.id], references: [userSettings.userId] }),
}));

export const sessionsRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountsRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const charactersRelations = relations(characters, ({ one, many }) => ({
  user: one(user, { fields: [characters.userId], references: [user.id] }),
  chats: many(chats),
}));

export const lorebooksRelations = relations(lorebooks, ({ one, many }) => ({
  user: one(user, { fields: [lorebooks.userId], references: [user.id] }),
  entries: many(loreEntries),
  userSettings: many(userLorebookSettings),
}));

export const loreEntriesRelations = relations(loreEntries, ({ one, many }) => ({
  lorebook: one(lorebooks, {
    fields: [loreEntries.lorebookId],
    references: [lorebooks.id],
  }),
  userSettings: many(userLoreEntrySettings),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(user, { fields: [chats.userId], references: [user.id] }),
  character: one(characters, {
    fields: [chats.characterId],
    references: [characters.id],
  }),
  provider: one(aiProviders, {
    fields: [chats.providerId],
    references: [aiProviders.id],
  }),
  preset: one(presets, {
    fields: [chats.presetId],
    references: [presets.id],
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
  user: one(user, { fields: [presets.userId], references: [user.id] }),
  provider: one(aiProviders, {
    fields: [presets.providerId],
    references: [aiProviders.id],
  }),
}));

export const aiProvidersRelations = relations(aiProviders, ({ one, many }) => ({
  user: one(user, { fields: [aiProviders.userId], references: [user.id] }),
  presets: many(presets),
}));

export const personasRelations = relations(personas, ({ one }) => ({
  user: one(user, { fields: [personas.userId], references: [user.id] }),
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
export type UserLorebookSettings = typeof userLorebookSettings.$inferSelect;
export type NewUserLorebookSettings = typeof userLorebookSettings.$inferInsert;
export type UserLoreEntrySettings = typeof userLoreEntrySettings.$inferSelect;
export type NewUserLoreEntrySettings = typeof userLoreEntrySettings.$inferInsert;
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
export type UserDailyUsage = typeof userDailyUsage.$inferSelect;
