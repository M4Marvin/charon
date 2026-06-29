import { asc, eq, sql } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import {
  account,
  aiProviders,
  characters,
  chatMessages,
  chats,
  loreEntries,
  lorebooks,
  personas,
  presets,
  session,
  user,
  userLorebookSettings,
  userLoreEntrySettings,
  userSettings,
  verification,
} from "@/db/schema";
import type { User } from "@/db/schema";

export type UserListItem = User;

export function listUsers(db: DB = defaultDb): UserListItem[] {
  return db.select().from(user).orderBy(asc(user.createdAt)).all();
}

export function countAdmins(db: DB = defaultDb): number {
  const row = db
    .select({ count: sql<number>`count(*)`.as("c") })
    .from(user)
    .where(eq(user.role, "admin"))
    .get();
  return row?.count ?? 0;
}

export function deleteUser(userId: string, db: DB = defaultDb): void {
  const userRow = db.select().from(user).where(eq(user.id, userId)).get();
  if (!userRow) throw new Error("User not found");

  const userChats = db.select({ id: chats.id }).from(chats).where(eq(chats.userId, userId)).all();
  const userChatIds = userChats.map((c) => c.id);

  for (const chatId of userChatIds) {
    db.delete(chatMessages).where(eq(chatMessages.chatId, chatId)).run();
  }

  db.delete(chats).where(eq(chats.userId, userId)).run();

  const userLorebooks = db.select({ id: lorebooks.id }).from(lorebooks).where(eq(lorebooks.userId, userId)).all();
  const userLorebookIds = userLorebooks.map((l) => l.id);

  for (const lorebookId of userLorebookIds) {
    const entries = db.select({ id: loreEntries.id }).from(loreEntries).where(eq(loreEntries.lorebookId, lorebookId)).all();
    const entryIds = entries.map((e) => e.id);

    for (const entryId of entryIds) {
      db.delete(userLoreEntrySettings).where(eq(userLoreEntrySettings.entryId, entryId)).run();
    }
    db.delete(loreEntries).where(eq(loreEntries.lorebookId, lorebookId)).run();
  }

  for (const lorebookId of userLorebookIds) {
    db.delete(userLorebookSettings).where(eq(userLorebookSettings.lorebookId, lorebookId)).run();
  }

  db.delete(userLorebookSettings).where(eq(userLorebookSettings.userId, userId)).run();
  db.delete(userLoreEntrySettings).where(eq(userLoreEntrySettings.userId, userId)).run();

  db.delete(lorebooks).where(eq(lorebooks.userId, userId)).run();
  db.delete(characters).where(eq(characters.userId, userId)).run();
  db.delete(personas).where(eq(personas.userId, userId)).run();
  db.delete(presets).where(eq(presets.userId, userId)).run();
  db.delete(aiProviders).where(eq(aiProviders.userId, userId)).run();
  db.delete(userSettings).where(eq(userSettings.userId, userId)).run();
  db.delete(session).where(eq(session.userId, userId)).run();
  db.delete(account).where(eq(account.userId, userId)).run();
  db.delete(verification).where(eq(verification.identifier, userRow.email)).run();
  db.delete(user).where(eq(user.id, userId)).run();
}

export type { User };
