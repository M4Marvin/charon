import { and, eq } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import { userLorebookSettings, userLoreEntrySettings } from "@/db/schema";

// Per-user overlay on lorebook activation. Presence in
// `user_lorebook_settings` = enabled. No row = disabled (opt-in default).
//
// The entry overlay (`user_lore_entry_settings`) follows the inverse
// convention: presence = user-disabled. AND semantics with the entry's
// own data.disable: an entry is active iff !data.disable && !userOverlay.

// ── Lorebook activation ─────────────────────────────────────────────────────

export function isLorebookEnabled(userId: string, lorebookId: string, db: DB = defaultDb): boolean {
  const row = db
    .select({ lorebookId: userLorebookSettings.lorebookId })
    .from(userLorebookSettings)
    .where(
      and(eq(userLorebookSettings.userId, userId), eq(userLorebookSettings.lorebookId, lorebookId)),
    )
    .get();
  return row !== undefined;
}

export function listEnabledLorebookIds(userId: string, db: DB = defaultDb): string[] {
  return db
    .select({ lorebookId: userLorebookSettings.lorebookId })
    .from(userLorebookSettings)
    .where(eq(userLorebookSettings.userId, userId))
    .all()
    .map((r) => r.lorebookId);
}

// enabled=true → INSERT (no-op on conflict). enabled=false → DELETE.
// Caller is responsible for verifying lorebook ownership; this fn does not.
export function setLorebookEnabled(
  userId: string,
  lorebookId: string,
  enabled: boolean,
  db: DB = defaultDb,
): void {
  if (enabled) {
    const now = new Date();
    db.insert(userLorebookSettings)
      .values({ userId, lorebookId, createdAt: now, updatedAt: now })
      .onConflictDoNothing({
        target: [userLorebookSettings.userId, userLorebookSettings.lorebookId],
      })
      .run();
  } else {
    db.delete(userLorebookSettings)
      .where(
        and(
          eq(userLorebookSettings.userId, userId),
          eq(userLorebookSettings.lorebookId, lorebookId),
        ),
      )
      .run();
  }
}

// ── Entry disable overlay ───────────────────────────────────────────────────

export function isEntryUserDisabled(userId: string, entryId: string, db: DB = defaultDb): boolean {
  const row = db
    .select({ entryId: userLoreEntrySettings.entryId })
    .from(userLoreEntrySettings)
    .where(
      and(eq(userLoreEntrySettings.userId, userId), eq(userLoreEntrySettings.entryId, entryId)),
    )
    .get();
  return row !== undefined;
}

export function listUserDisabledEntryIds(userId: string, db: DB = defaultDb): string[] {
  return db
    .select({ entryId: userLoreEntrySettings.entryId })
    .from(userLoreEntrySettings)
    .where(eq(userLoreEntrySettings.userId, userId))
    .all()
    .map((r) => r.entryId);
}

// disabled=true → INSERT. disabled=false → DELETE.
// Caller is responsible for verifying transitive ownership (entry → lorebook
// → user). This fn does not check.
export function setLoreEntryDisabled(
  userId: string,
  entryId: string,
  disabled: boolean,
  db: DB = defaultDb,
): void {
  if (disabled) {
    const now = new Date();
    db.insert(userLoreEntrySettings)
      .values({ userId, entryId, createdAt: now, updatedAt: now })
      .onConflictDoNothing({
        target: [userLoreEntrySettings.entryId, userLoreEntrySettings.userId],
      })
      .run();
  } else {
    db.delete(userLoreEntrySettings)
      .where(
        and(eq(userLoreEntrySettings.userId, userId), eq(userLoreEntrySettings.entryId, entryId)),
      )
      .run();
  }
}
