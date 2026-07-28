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
  userMessageCount: number;
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

function escapeLike(pattern: string): string {
  return pattern.replace(/[%_\\]/g, "\\$&");
}

export type SearchParams = {
  q?: string;
  tags?: string[];
  sort?: "name-asc" | "chats-desc" | "updatedAt-desc";
  offset: number;
  limit: number;
};

export function searchCharacterCards(
  userId: string,
  opts: SearchParams,
  db: DB = defaultDb,
): { items: CharacterCardItem[]; total: number } {
  const conditions: ReturnType<typeof sql>[] = [eq(characters.userId, userId)];

  if (opts.q && opts.q.trim()) {
    const q = `%${escapeLike(opts.q.trim())}%`;
    conditions.push(
      sql`(${characters.name} LIKE ${q} ESCAPE '\\'
          OR ${characters.creator} LIKE ${q} ESCAPE '\\'
          OR ${characters.creatorNotes} LIKE ${q} ESCAPE '\\'
          OR ${characters.tagline} LIKE ${q} ESCAPE '\\')`,
    );
  }

  if (opts.tags && opts.tags.length > 0) {
    for (const tag of opts.tags) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM json_each(${characters.tags}) WHERE json_each.value = ${tag})`,
      );
    }
  }

  const where = and(...conditions) as ReturnType<typeof and>;

  const totalRow = db
    .select({ count: count() })
    .from(characters)
    .where(where)
    .get();
  const total = totalRow?.count ?? 0;

  let orderBy;
  switch (opts.sort) {
    case "name-asc":
      orderBy = sql`${characters.name} COLLATE NOCASE ASC`;
      break;
    case "chats-desc":
      orderBy = desc(count(chats.id));
      break;
    default:
      orderBy = desc(characters.updatedAt);
  }

  const rows = db
    .select({
      character: characters,
      chatCount: count(chats.id),
    })
    .from(characters)
    .leftJoin(chats, eq(chats.characterId, characters.id))
    .where(where)
    .groupBy(characters.id)
    .orderBy(orderBy)
    .limit(opts.limit)
    .offset(opts.offset)
    .all();

  const items: CharacterCardItem[] = rows.map((r) => ({
    id: r.character.id,
    name: r.character.name,
    spec: r.character.spec,
    specVersion: r.character.specVersion,
    imagePath: r.character.imagePath,
    tagline: r.character.tagline,
    createdAt: r.character.createdAt,
    updatedAt: r.character.updatedAt,
    tags: r.character.tags as string[],
    creatorNotes: r.character.creatorNotes,
    creator: r.character.creator,
    chatCount: r.chatCount,
  }));

  return { items, total };
}

export function characterTagCounts(
  userId: string,
  db: DB = defaultDb,
): { name: string; count: number }[] {
  type Row = { name: string; count: number };
  return db.all<Row>(
    sql`SELECT json_each.value AS name, count(*) AS count
        FROM characters, json_each(characters.tags)
        WHERE characters.user_id = ${userId}
        GROUP BY json_each.value
        ORDER BY json_each.value`,
  );
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
      userMessageCount: sql<number>`count(${chatMessages.localId})`.as("userMessageCount"),
    })
    .from(characters)
    .leftJoin(chats, eq(chats.characterId, characters.id))
    .leftJoin(
      chatMessages,
      and(eq(chatMessages.chatId, chats.id), eq(chatMessages.role, "user")),
    )
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .groupBy(characters.id)
    .get();

  if (!row) throw new Error("Character not found");
  return { ...row.character, chatCount: row.chatCount, userMessageCount: row.userMessageCount };
}

export function derivedColumns(data: CharacterDataV2) {
  return {
    creator: data.creator ?? "",
    creatorNotes: data.creator_notes ?? "",
    tags: data.tags ?? [],
  };
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
      ...derivedColumns(input.data),
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
  const derived = patch.data ? derivedColumns(patch.data) : {};
  const row = db
    .update(characters)
    .set({ ...patch, ...derived, updatedAt: new Date() })
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
