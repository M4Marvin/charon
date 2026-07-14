import { and, count, desc, eq, sql } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import { characters, chatMessages, chats, type Character, type NewCharacter } from "@/db/schema";
import type { CharacterDataV2 } from "@/lib/st-core/character";

export type CharacterCardItem = Pick<
  Character,
  "id" | "name" | "spec" | "specVersion" | "imagePath" | "tagline" | "createdAt" | "updatedAt"
> & {
  tags: string[];
  creatorNotes: string;
  creator: string;
  chatCount: number;
};

export type CharacterDetail = Character & {
  chatCount: number;
  totalMessageCount: number;
};

export type CreateCharacterInput = {
  id: string;
  userId: string;
  name: string;
  data: CharacterDataV2;
  imagePath?: string | null;
  tagline?: string | null;
  // Spec identification. Defaults to V2 in the DB schema; V3 import paths
  // override these to preserve the original card's spec.
  spec?: "chara_card_v2" | "chara_card_v3";
  specVersion?: "2.0" | "3.0";
};

export function listCharacters(userId: string, db: DB = defaultDb): Character[] {
  return db.select().from(characters).where(eq(characters.userId, userId)).all();
}

export function listCharacterCards(userId: string, db: DB = defaultDb): CharacterCardItem[] {
  const rows = db
    .select({
      character: characters,
      chatCount: count(chats.id),
    })
    .from(characters)
    .leftJoin(chats, eq(chats.characterId, characters.id))
    .where(eq(characters.userId, userId))
    .groupBy(characters.id)
    .orderBy(desc(characters.updatedAt))
    .all();
  return rows.map((r) => ({
    id: r.character.id,
    name: r.character.name,
    spec: r.character.spec,
    specVersion: r.character.specVersion,
    imagePath: r.character.imagePath,
    tagline: r.character.tagline,
    createdAt: r.character.createdAt,
    updatedAt: r.character.updatedAt,
    tags: r.character.data.tags,
    creatorNotes: r.character.data.creator_notes,
    creator: r.character.data.creator,
    chatCount: r.chatCount,
  }));
}

export function getCharacter(userId: string, id: string, db: DB = defaultDb): Character {
  const row = db
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .get();
  if (!row) throw new Error("Character not found");
  return row;
}

export function getCharacterDetail(
  userId: string,
  id: string,
  db: DB = defaultDb,
): CharacterDetail {
  const row = db
    .select({
      character: characters,
      chatCount: sql<number>`count(distinct ${chats.id})`.as("chatCount"),
      totalMessageCount: sql<number>`count(${chatMessages.localId})`.as("totalMessageCount"),
    })
    .from(characters)
    .leftJoin(chats, eq(chats.characterId, characters.id))
    .leftJoin(chatMessages, eq(chatMessages.chatId, chats.id))
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .groupBy(characters.id)
    .get();

  if (!row) throw new Error("Character not found");
  return { ...row.character, chatCount: row.chatCount, totalMessageCount: row.totalMessageCount };
}

export function createCharacter(input: CreateCharacterInput, db: DB = defaultDb): Character {
  const now = new Date();
  const row = db
    .insert(characters)
    .values({
      id: input.id,
      userId: input.userId,
      name: input.name,
      data: input.data,
      imagePath: input.imagePath ?? null,
      tagline: input.tagline ?? null,
      spec: input.spec ?? "chara_card_v2",
      specVersion: input.specVersion ?? "2.0",
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  if (!row) throw new Error("Failed to create character");
  return row;
}

export function updateCharacter(
  userId: string,
  id: string,
  patch: Partial<
    Pick<NewCharacter, "name" | "data" | "spec" | "specVersion" | "imagePath" | "tagline">
  >,
  db: DB = defaultDb,
): Character {
  const row = db
    .update(characters)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .returning()
    .get();
  if (!row) throw new Error("Character not found");
  return row;
}

export function deleteCharacter(userId: string, id: string, db: DB = defaultDb): void {
  const result = db
    .delete(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .run();
  if (result.changes === 0) throw new Error("Character not found");
}
