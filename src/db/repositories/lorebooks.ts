import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import {
  lorebooks,
  loreEntries,
  userLorebookSettings,
  userLoreEntrySettings,
  type Lorebook,
  type LoreEntry,
  type NewLorebook,
  type NewLoreEntry,
} from "@/db/schema";
import type { LoreConfig, LoreEntry as LoreEntryData } from "@/lib/st-core/lorebook";

export type CreateLorebookInput = {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  config: LoreConfig;
};

export type LorebookWithCount = Lorebook & {
  entryCount: number;
  // Per-user activation overlay. True iff the user has toggled this
  // lorebook on. No row in user_lorebook_settings = disabled (opt-in).
  enabled: boolean;
};

export type LoreEntryWithUserState = LoreEntry & {
  // Per-user disable overlay. True iff the user has disabled this entry.
  // AND semantics with the entry's own data.disable.
  userDisabled: boolean;
};

export type CreateLoreEntryInput = {
  id: string;
  lorebookId: string;
  uid: number;
  data: LoreEntryData;
};

export function listLorebooks(userId: string, db: DB = defaultDb): LorebookWithCount[] {
  const rows = db
    .select({
      lorebook: lorebooks,
      entryCount: count(loreEntries.id),
      enabled: sql<number>`MAX(CASE WHEN ${userLorebookSettings.lorebookId} IS NOT NULL THEN 1 ELSE 0 END)`,
    })
    .from(lorebooks)
    .leftJoin(loreEntries, eq(loreEntries.lorebookId, lorebooks.id))
    .leftJoin(
      userLorebookSettings,
      and(
        eq(userLorebookSettings.lorebookId, lorebooks.id),
        eq(userLorebookSettings.userId, userId),
      ),
    )
    .where(eq(lorebooks.userId, userId))
    .groupBy(lorebooks.id)
    .orderBy(asc(lorebooks.name))
    .all();
  return rows.map((r) => ({
    ...r.lorebook,
    entryCount: r.entryCount,
    enabled: r.enabled === 1,
  }));
}

export function getLorebook(userId: string, id: string, db: DB = defaultDb): Lorebook {
  const row = db
    .select()
    .from(lorebooks)
    .where(and(eq(lorebooks.id, id), eq(lorebooks.userId, userId)))
    .get();
  if (!row) throw new Error("Lorebook not found");
  return row;
}

export function createLorebook(
  input: CreateLorebookInput,
  db: DB = defaultDb,
): Lorebook {
  const now = new Date();
  const row = db
    .insert(lorebooks)
    .values({
      id: input.id,
      userId: input.userId,
      name: input.name,
      description: input.description ?? null,
      config: input.config,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  if (!row) throw new Error("Failed to create lorebook");
  return row;
}

export function updateLorebook(
  userId: string,
  id: string,
  patch: Partial<
    Pick<NewLorebook, "name" | "description" | "config">
  >,
  db: DB = defaultDb,
): Lorebook {
  const row = db
    .update(lorebooks)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(lorebooks.id, id), eq(lorebooks.userId, userId)))
    .returning()
    .get();
  if (!row) throw new Error("Lorebook not found");
  return row;
}

export function deleteLorebook(userId: string, id: string, db: DB = defaultDb): void {
  // Manually cascade: FK enforcement is off in dev.db. Collect child ids
  // first, then wipe everything in one transaction-equivalent sequence.
  const childEntries = db
    .select({ id: loreEntries.id })
    .from(loreEntries)
    .where(eq(loreEntries.lorebookId, id))
    .all();
  const childEntryIds = childEntries.map((r) => r.id);

  if (childEntryIds.length > 0) {
    // Per-entry user overlay rows for entries in this lorebook.
    db.delete(userLoreEntrySettings)
      .where(inArray(userLoreEntrySettings.entryId, childEntryIds))
      .run();
  }
  // Per-lorebook user overlay rows for this lorebook.
  db.delete(userLorebookSettings).where(eq(userLorebookSettings.lorebookId, id)).run();
  // Orphan entries (FK is off, so they wouldn't be cleaned up otherwise).
  db.delete(loreEntries).where(eq(loreEntries.lorebookId, id)).run();

  const result = db
    .delete(lorebooks)
    .where(and(eq(lorebooks.id, id), eq(lorebooks.userId, userId)))
    .run();
  if (result.changes === 0) throw new Error("Lorebook not found");
}

export function listEntries(
  userId: string,
  lorebookId: string,
  db: DB = defaultDb,
): LoreEntryWithUserState[] {
  getLorebook(userId, lorebookId, db);
  const rows = db
    .select({
      entry: loreEntries,
      userDisabled: sql<number>`MAX(CASE WHEN ${userLoreEntrySettings.entryId} IS NOT NULL THEN 1 ELSE 0 END)`,
    })
    .from(loreEntries)
    .leftJoin(
      userLoreEntrySettings,
      and(
        eq(userLoreEntrySettings.entryId, loreEntries.id),
        eq(userLoreEntrySettings.userId, userId),
      ),
    )
    .where(eq(loreEntries.lorebookId, lorebookId))
    .groupBy(loreEntries.id)
    .orderBy(asc(loreEntries.uid))
    .all();
  return rows.map((r) => ({ ...r.entry, userDisabled: r.userDisabled === 1 }));
}

export function getEntry(
  userId: string,
  lorebookId: string,
  entryId: string,
  db: DB = defaultDb,
): LoreEntry {
  getLorebook(userId, lorebookId, db);
  const row = db
    .select()
    .from(loreEntries)
    .where(and(eq(loreEntries.id, entryId), eq(loreEntries.lorebookId, lorebookId)))
    .get();
  if (!row) throw new Error("Lore entry not found");
  return row;
}

export function createEntry(
  userId: string,
  input: CreateLoreEntryInput,
  db: DB = defaultDb,
): LoreEntry {
  getLorebook(userId, input.lorebookId, db);
  const now = new Date();
  const row = db
    .insert(loreEntries)
    .values({
      id: input.id,
      lorebookId: input.lorebookId,
      uid: input.uid,
      data: input.data,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  if (!row) throw new Error("Failed to create lore entry");
  return row;
}

export function updateEntry(
  userId: string,
  lorebookId: string,
  entryId: string,
  patch: Partial<Pick<NewLoreEntry, "uid" | "data">>,
  db: DB = defaultDb,
): LoreEntry {
  getLorebook(userId, lorebookId, db);
  const row = db
    .update(loreEntries)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(loreEntries.id, entryId), eq(loreEntries.lorebookId, lorebookId)))
    .returning()
    .get();
  if (!row) throw new Error("Lore entry not found");
  return row;
}

export function deleteEntry(
  userId: string,
  lorebookId: string,
  entryId: string,
  db: DB = defaultDb,
): void {
  getLorebook(userId, lorebookId, db);
  // Manual cascade: clear the per-user disable overlay for this entry.
  db.delete(userLoreEntrySettings)
    .where(eq(userLoreEntrySettings.entryId, entryId))
    .run();
  const result = db
    .delete(loreEntries)
    .where(and(eq(loreEntries.id, entryId), eq(loreEntries.lorebookId, lorebookId)))
    .run();
  if (result.changes === 0) throw new Error("Lore entry not found");
}

export function nextEntryUid(
  userId: string,
  lorebookId: string,
  db: DB = defaultDb,
): number {
  getLorebook(userId, lorebookId, db);
  const row = db
    .select({ max: sql<number>`COALESCE(MAX(${loreEntries.uid}), 0)` })
    .from(loreEntries)
    .where(eq(loreEntries.lorebookId, lorebookId))
    .get();
  return (row?.max ?? 0) + 1;
}
