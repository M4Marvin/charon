import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import {
  characters,
  chatMessages,
  chats,
  characterRevisions,
  type Character,
  type NewCharacter,
} from "@/db/schema";
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
  messageCount: number;
};

export type CreateCharacterInput = {
  id: string;
  name: string;
  data: CharacterDataV2;
  imagePath?: string | null;
  tagline?: string | null;
  // Spec identification. Defaults to V2 in the DB schema; V3 import paths
  // override these to preserve the original card's spec.
  spec?: "chara_card_v2" | "chara_card_v3";
  specVersion?: "2.0" | "3.0";
};

export function listCharacters(db: DB = defaultDb): Character[] {
  return db.select().from(characters).all();
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
  opts: SearchParams,
  db: DB = defaultDb,
): { items: CharacterCardItem[]; total: number } {
  const conditions: ReturnType<typeof sql>[] = [];

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

  const totalRow = db.select({ count: count() }).from(characters).where(where).get();
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

export function characterTagCounts(db: DB = defaultDb): { name: string; count: number }[] {
  type Row = { name: string; count: number };
  return db.all<Row>(
    sql`SELECT json_each.value AS name, count(*) AS count
        FROM characters, json_each(characters.tags)
        GROUP BY json_each.value
        ORDER BY json_each.value`,
  );
}

export function getCharacter(id: string, db: DB = defaultDb): Character {
  const row = db.select().from(characters).where(eq(characters.id, id)).get();
  if (!row) throw new Error("Character not found");
  return row;
}

export function getCharacterDetail(id: string, db: DB = defaultDb): CharacterDetail {
  const row = db
    .select({
      character: characters,
      chatCount: sql<number>`count(distinct ${chats.id})`.as("chatCount"),
      userMessageCount: sql<number>`count(${chatMessages.localId})`.as("userMessageCount"),
      messageCount: sql<number>`(
        select count(*) from ${chatMessages}
        where ${chatMessages.chatId} in (
          select ${chats.id} from ${chats}
          where ${chats.characterId} = ${characters.id}
        )
      )`.as("messageCount"),
    })
    .from(characters)
    .leftJoin(chats, eq(chats.characterId, characters.id))
    .leftJoin(chatMessages, and(eq(chatMessages.chatId, chats.id), eq(chatMessages.role, "user")))
    .where(eq(characters.id, id))
    .groupBy(characters.id)
    .get();

  if (!row) throw new Error("Character not found");
  return {
    ...row.character,
    chatCount: row.chatCount,
    userMessageCount: row.userMessageCount,
    messageCount: row.messageCount,
  };
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
  // The baseline revision 1 is created atomically with the row so every
  // character enters the world satisfying "latest revision equals the
  // current card".
  return db.transaction((tx) => {
    const row = tx
      .insert(characters)
      .values({
        id: input.id,
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
    tx.insert(characterRevisions)
      .values({
        characterId: row.id,
        rev: 1,
        name: row.name,
        tagline: row.tagline,
        spec: row.spec,
        specVersion: row.specVersion,
        data: row.data,
        createdAt: now,
      })
      .run();
    return row;
  });
}

/**
 * Raw, revision-free row update. Do not call from feature code: it breaks the
 * "latest revision equals the current card" invariant. Use
 * `updateCharacterWithRevision` / `restoreCharacterRevision` from
 * `@/db/repositories/character-revisions` instead — this exists only for those
 * transactional helpers (and tests).
 * @internal
 */
export function updateCharacter(
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
    .where(eq(characters.id, id))
    .returning()
    .get();
  if (!row) throw new Error("Character not found");
  return row;
}

export function deleteCharacter(id: string, db: DB = defaultDb): void {
  // Manually delete chats and messages first since FK enforcement is off in dev.db
  // (mirrors deleteChat in src/db/repositories/chats.ts:148-158).
  const chatIds = db
    .select({ id: chats.id })
    .from(chats)
    .where(eq(chats.characterId, id))
    .all()
    .map((r) => r.id);
  if (chatIds.length > 0) {
    db.delete(chatMessages).where(inArray(chatMessages.chatId, chatIds)).run();
    db.delete(chats).where(inArray(chats.id, chatIds)).run();
  }
  db.delete(characterRevisions).where(eq(characterRevisions.characterId, id)).run();
  const result = db.delete(characters).where(eq(characters.id, id)).run();
  if (result.changes === 0) throw new Error("Character not found");
}
