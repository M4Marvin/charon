import { and, desc, eq, sql } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import {
  characterRevisions,
  type Character,
  type CharacterRevision,
  type NewCharacter,
} from "@/db/schema";
import { updateCharacter } from "@/db/repositories/characters";
import type { CharacterDataV2 } from "@/lib/st-core/character";

export type RevisionSummary = Pick<
  CharacterRevision,
  "id" | "characterId" | "rev" | "name" | "tagline" | "createdAt"
>;

export type RevisionSnapshot = {
  name: string;
  tagline: string | null;
  data: CharacterDataV2;
};

/** Insert the next revision for a character (rev = current max + 1). */
export function createRevision(
  characterId: string,
  snapshot: RevisionSnapshot,
  db: DB = defaultDb,
): CharacterRevision {
  const maxRow = db
    .select({ rev: sql<number>`coalesce(max(${characterRevisions.rev}), 0)` })
    .from(characterRevisions)
    .where(eq(characterRevisions.characterId, characterId))
    .get();
  const nextRev = (maxRow?.rev ?? 0) + 1;
  const row = db
    .insert(characterRevisions)
    .values({
      characterId,
      rev: nextRev,
      name: snapshot.name,
      tagline: snapshot.tagline,
      data: snapshot.data,
    })
    .returning()
    .get();
  if (!row) throw new Error("Failed to create character revision");
  return row;
}

/** Revision list view without the data blob, newest first. */
export function listRevisions(characterId: string, db: DB = defaultDb): RevisionSummary[] {
  return db
    .select({
      id: characterRevisions.id,
      characterId: characterRevisions.characterId,
      rev: characterRevisions.rev,
      name: characterRevisions.name,
      tagline: characterRevisions.tagline,
      createdAt: characterRevisions.createdAt,
    })
    .from(characterRevisions)
    .where(eq(characterRevisions.characterId, characterId))
    .orderBy(desc(characterRevisions.rev))
    .all();
}

export function getRevision(
  characterId: string,
  rev: number,
  db: DB = defaultDb,
): CharacterRevision {
  const row = db
    .select()
    .from(characterRevisions)
    .where(and(eq(characterRevisions.characterId, characterId), eq(characterRevisions.rev, rev)))
    .get();
  if (!row) throw new Error("Revision not found");
  return row;
}

/**
 * Update a character and snapshot the post-save state in one transaction, so
 * the "latest revision equals the current card" invariant cannot be broken by
 * a partial write. Scalar-only patches (rename) snapshot the full post-save
 * row, so the new name is recorded against the unchanged data.
 */
export function updateCharacterWithRevision(
  id: string,
  patch: Partial<Pick<NewCharacter, "name" | "data" | "tagline">>,
  db: DB = defaultDb,
): Character {
  return db.transaction((tx) => {
    const row = updateCharacter(id, patch, tx);
    createRevision(row.id, { name: row.name, tagline: row.tagline, data: row.data }, tx);
    return row;
  });
}

/**
 * Restore an old revision: copy its snapshot onto the character and append a
 * new revision with the restored state. History is append-only.
 */
export function restoreCharacterRevision(id: string, rev: number, db: DB = defaultDb): Character {
  return db.transaction((tx) => {
    const snapshot = getRevision(id, rev, tx);
    const row = updateCharacter(
      id,
      { name: snapshot.name, data: snapshot.data, tagline: snapshot.tagline },
      tx,
    );
    createRevision(row.id, { name: row.name, tagline: row.tagline, data: row.data }, tx);
    return row;
  });
}
