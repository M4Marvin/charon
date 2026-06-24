import { and, asc, eq, inArray } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import {
  chats,
  chatMessages,
  characters,
  type Chat,
  type ChatMessageRow,
  type NewChatMessageRow,
} from "@/db/schema";

export type ChatWithCharacter = Chat & {
  characterName: string;
  characterImagePath: string | null;
};

export type CreateChatInput = {
  id: string;
  userId: string;
  characterId: string;
  title: string;
};

export type MessagePatch = Pick<ChatMessageRow, "children" | "selectedChildLocalId"> &
  Partial<Pick<ChatMessageRow, "content" | "name" | "extra">>;

export function listChats(userId: string, db: DB = defaultDb): ChatWithCharacter[] {
  const rows = db
    .select({
      chat: chats,
      characterName: characters.name,
      characterImagePath: characters.imagePath,
    })
    .from(chats)
    .leftJoin(characters, eq(chats.characterId, characters.id))
    .where(eq(chats.userId, userId))
    .orderBy(asc(chats.createdAt))
    .all();
  return rows.map((r) => ({
    ...r.chat,
    characterName: r.characterName ?? "Unknown",
    characterImagePath: r.characterImagePath ?? null,
  }));
}

export function getChat(userId: string, id: string, db: DB = defaultDb): Chat {
  const row = db
    .select()
    .from(chats)
    .where(and(eq(chats.id, id), eq(chats.userId, userId)))
    .get();
  if (!row) throw new Error("Chat not found");
  return row;
}

export function createChat(input: CreateChatInput, db: DB = defaultDb): Chat {
  const now = new Date();
  const row = db
    .insert(chats)
    .values({
      id: input.id,
      userId: input.userId,
      characterId: input.characterId,
      title: input.title,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  if (!row) throw new Error("Failed to create chat");
  return row;
}

export function deleteChat(userId: string, id: string, db: DB = defaultDb): void {
  // Manually delete messages first since FK enforcement is off in dev.db
  db.delete(chatMessages).where(eq(chatMessages.chatId, id)).run();
  const result = db
    .delete(chats)
    .where(and(eq(chats.id, id), eq(chats.userId, userId)))
    .run();
  if (result.changes === 0) throw new Error("Chat not found");
}

export function listMessages(userId: string, chatId: string, db: DB = defaultDb): ChatMessageRow[] {
  // Verify chat ownership first
  getChat(userId, chatId, db);
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(asc(chatMessages.localId))
    .all();
}

export function getMessage(
  userId: string,
  chatId: string,
  localId: number,
  db: DB = defaultDb,
): ChatMessageRow | undefined {
  // Verify chat ownership first
  getChat(userId, chatId, db);
  return db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.chatId, chatId), eq(chatMessages.localId, localId)))
    .get();
}

export function insertMessage(
  userId: string,
  chatId: string,
  msg: NewChatMessageRow,
  db: DB = defaultDb,
): void {
  getChat(userId, chatId, db);
  db.insert(chatMessages).values(msg).run();
}

export function updateMessage(
  userId: string,
  chatId: string,
  localId: number,
  patch: MessagePatch,
  db: DB = defaultDb,
): void {
  getChat(userId, chatId, db);
  db.update(chatMessages)
    .set(patch)
    .where(and(eq(chatMessages.chatId, chatId), eq(chatMessages.localId, localId)))
    .run();
}

export function deleteMessages(
  userId: string,
  chatId: string,
  localIds: number[],
  db: DB = defaultDb,
): void {
  getChat(userId, chatId, db);
  db.delete(chatMessages)
    .where(
      and(
        eq(chatMessages.chatId, chatId),
        inArray(chatMessages.localId, localIds),
      ),
    )
    .run();
}
