import { and, desc, eq, sql } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import {
  characterRevisions,
  characters,
  type Character,
  type CharacterRevision,
  type NewCharacter,
} from "@/db/schema";
import { updateCharacter } from "@/db/repositories/characters";
import { CHARACTER_NOT_FOUND, REVISION_NOT_FOUND } from "@/lib/app-errors";
import type { CharacterDataV2 } from "@/lib/st-core/character";

export type RevisionSummary = Pick<
  CharacterRevision,
  "id" | "characterId" | "rev" | "name" | "tagline" | "createdAt"
>;

export type RevisionSnapshot = {
  name: string;
  tagline: string | null;
  spec: string;
  specVersion: string;
  data: CharacterDataV2;
};

/**
 * Insert the next revision for a character (rev = current max + 1).
 *
 * @internal Do not call from feature code: it appends a snapshot without
 * touching the character row, which would break the "latest revision equals
 * the current card" invariant. Use `updateCharacterWithRevision` /
 * `restoreCharacterRevision` (or `createCharacter`, which seeds the baseline)
 * instead — this exists only for those transactional helpers (and tests).
 */
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
      spec: snapshot.spec,
      specVersion: snapshot.specVersion,
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
  if (row) return row;
  // Distinguish a bad rev on a live character from a deleted character, so
  // consumers can route the latter through isCharacterNotFound (the ui-spec
  // not-found path) instead of a generic "revision" failure.
  const characterExists = db
    .select({ id: characters.id })
    .from(characters)
    .where(eq(characters.id, characterId))
    .get();
  throw new Error(characterExists ? REVISION_NOT_FOUND : CHARACTER_NOT_FOUND);
}

/**
 * Update a character and snapshot the post-save state in one transaction, so
 * the "latest revision equals the current card" invariant cannot be broken by
 * a partial write. Scalar-only patches (rename) snapshot the full post-save
 * row, so the new name is recorded against the unchanged data.
 *
 * A save whose snapshot already equals the latest revision (a no-op save, an
 * edit-then-revert, re-updating an identical card) appends nothing: the
 * invariant already holds, so the identical blob would only clutter history
 * with a "no tracked fields differ" row. Restore is exempt — it is an
 * explicit user action and is always recorded.
 */
export function updateCharacterWithRevision(
  id: string,
  patch: Partial<
    Pick<NewCharacter, "name" | "data" | "spec" | "specVersion" | "imagePath" | "tagline">
  >,
  db: DB = defaultDb,
): Character {
  return db.transaction((tx) => {
    const row = updateCharacter(id, patch, tx);
    const snapshot = {
      name: row.name,
      tagline: row.tagline,
      spec: row.spec,
      specVersion: row.specVersion,
      data: row.data,
    };
    const latest = latestRevision(row.id, tx);
    if (!latest || !sameSnapshot(latest, snapshot)) {
      createRevision(row.id, snapshot, tx);
    }
    return row;
  });
}

/** Newest revision for a character, or undefined when none exists. */
function latestRevision(characterId: string, db: DB): CharacterRevision | undefined {
  return db
    .select()
    .from(characterRevisions)
    .where(eq(characterRevisions.characterId, characterId))
    .orderBy(desc(characterRevisions.rev))
    .limit(1)
    .get();
}

/** Snapshot equality across the fields a revision records. */
function sameSnapshot(latest: CharacterRevision, next: RevisionSnapshot): boolean {
  return (
    latest.name === next.name &&
    latest.tagline === next.tagline &&
    latest.spec === next.spec &&
    latest.specVersion === next.specVersion &&
    JSON.stringify(latest.data) === JSON.stringify(next.data)
  );
}

/**
 * Restore an old revision: copy its snapshot (name, tagline, data, and the
 * spec the data was written under) onto the character and append a new
 * revision with the restored state. History is append-only. The avatar is not
 * part of the snapshot and follows the row.
 */
export function restoreCharacterRevision(id: string, rev: number, db: DB = defaultDb): Character {
  return db.transaction((tx) => {
    const snapshot = getRevision(id, rev, tx);
    const row = updateCharacter(
      id,
      {
        name: snapshot.name,
        data: snapshot.data,
        tagline: snapshot.tagline,
        spec: snapshot.spec,
        specVersion: snapshot.specVersion,
      },
      tx,
    );
    createRevision(
      row.id,
      {
        name: row.name,
        tagline: row.tagline,
        spec: row.spec,
        specVersion: row.specVersion,
        data: row.data,
      },
      tx,
    );
    return row;
  });
}
