import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
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
  lastMessagePreview: string | null;
  userMessageCount: number;
};

type ChatJoinRow = {
  chat: Chat;
  characterName: string | null;
  characterImagePath: string | null;
};

/**
 * Enriches chat join rows with last-message preview and user message count
 * using two batched queries instead of N+1 per-chat queries.
 */
function enrichChats(rows: ChatJoinRow[], db: DB): ChatWithCharacter[] {
  if (rows.length === 0) return [];

  const chatIds = rows.map((r) => r.chat.id);

  // Batched: user message counts per chat (role = 'user' only)
  const userCounts = db
    .select({ chatId: chatMessages.chatId, c: count() })
    .from(chatMessages)
    .where(and(inArray(chatMessages.chatId, chatIds), eq(chatMessages.role, "user")))
    .groupBy(chatMessages.chatId)
    .all();
  const userCountMap = new Map(userCounts.map((uc) => [uc.chatId, uc.c]));

  // Batched: latest message preview per chat via correlated subquery
  const previews = db
    .select({ chatId: chatMessages.chatId, content: chatMessages.content })
    .from(chatMessages)
    .where(
      and(
        inArray(chatMessages.chatId, chatIds),
        sql`${chatMessages.localId} = (
          SELECT MAX(cm.local_id) FROM chat_messages cm WHERE cm.chat_id = ${chatMessages.chatId}
        )`,
      ),
    )
    .all();
  const previewMap = new Map(previews.map((p) => [p.chatId, p.content.slice(0, 140)]));

  return rows.map((r) => ({
    ...r.chat,
    characterName: r.characterName ?? "Unknown",
    characterImagePath: r.characterImagePath ?? null,
    lastMessagePreview: previewMap.get(r.chat.id) ?? null,
    userMessageCount: userCountMap.get(r.chat.id) ?? 0,
  }));
}

export type CreateChatInput = {
  id: string;
  userId: string;
  characterId: string;
  title: string;
  characterDescription?: string;
  characterPersonality?: string;
  characterScenario?: string;
  characterSystemPrompt?: string;
};

export type MessagePatch = Partial<
  Pick<ChatMessageRow, "children" | "selectedChildLocalId" | "content" | "extra">
>;

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
    .orderBy(desc(chats.updatedAt))
    .all();
  return enrichChats(rows, db);
}

export function listChatsByCharacter(
  userId: string,
  characterId: string,
  db: DB = defaultDb,
): ChatWithCharacter[] {
  const rows = db
    .select({
      chat: chats,
      characterName: characters.name,
      characterImagePath: characters.imagePath,
    })
    .from(chats)
    .leftJoin(characters, eq(chats.characterId, characters.id))
    .where(and(eq(chats.userId, userId), eq(chats.characterId, characterId)))
    .orderBy(desc(chats.updatedAt))
    .all();
  return enrichChats(rows, db);
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
      characterDescription: input.characterDescription ?? "",
      characterPersonality: input.characterPersonality ?? "",
      characterScenario: input.characterScenario ?? "",
      characterSystemPrompt: input.characterSystemPrompt ?? "",
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  if (!row) throw new Error("Failed to create chat");
  return row;
}

export function deleteChat(userId: string, id: string, db: DB = defaultDb): void {
  // Verify ownership before deleting anything
  getChat(userId, id, db);
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

function touchChat(chatId: string, db: DB = defaultDb): void {
  db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId)).run();
}

export function insertMessage(
  userId: string,
  chatId: string,
  msg: NewChatMessageRow,
  db: DB = defaultDb,
): void {
  getChat(userId, chatId, db);
  db.insert(chatMessages).values(msg).run();
  touchChat(chatId, db);
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
  touchChat(chatId, db);
}

export function updateChat(
  userId: string,
  id: string,
  patch: Partial<
    Pick<
      Chat,
      | "characterDescription"
      | "characterPersonality"
      | "characterScenario"
      | "characterSystemPrompt"
      | "title"
      | "backgroundId"
    >
  >,
  db: DB = defaultDb,
): Chat {
  const existing = getChat(userId, id, db);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.characterDescription !== undefined)
    updates.characterDescription = patch.characterDescription;
  if (patch.characterPersonality !== undefined)
    updates.characterPersonality = patch.characterPersonality;
  if (patch.characterScenario !== undefined) updates.characterScenario = patch.characterScenario;
  if (patch.characterSystemPrompt !== undefined)
    updates.characterSystemPrompt = patch.characterSystemPrompt;
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.backgroundId !== undefined) updates.backgroundId = patch.backgroundId;
  const row = db
    .update(chats)
    .set(updates)
    .where(and(eq(chats.id, existing.id), eq(chats.userId, userId)))
    .returning()
    .get();
  if (!row) throw new Error("Chat not found");
  return row;
}

export function deleteMessages(
  userId: string,
  chatId: string,
  localIds: number[],
  db: DB = defaultDb,
): void {
  getChat(userId, chatId, db);
  db.delete(chatMessages)
    .where(and(eq(chatMessages.chatId, chatId), inArray(chatMessages.localId, localIds)))
    .run();
  touchChat(chatId, db);
}
