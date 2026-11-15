import type Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

/**
 * 0027_character_revisions briefly shipped with a future-dated journal stamp
 * (2026-12-15, see commit f58cd21). drizzle's SQLite migrator records each
 * applied migration's journal `when` and applies only entries whose `when` is
 * greater than the newest recorded value, so any database that applied 0027
 * under the future stamp has a recorded ceiling above 0028's `when` and would
 * silently skip 0028 forever (then crash on the first `spec` query). Repair
 * the recorded stamp to the corrected value before the migrator filters.
 *
 * The repair is idempotent: it matches nothing on databases that recorded the
 * corrected stamp, and is skipped entirely on fresh databases (no journal
 * table yet). Rule going forward: never re-stamp a shipped migration downward
 * — the migrator's ceiling logic makes that silently skip later migrations.
 */
const BAD_0027_STAMP = 1797336000000;
const FIXED_0027_STAMP = 1794652121346;

export function migrateWithStampRepair<TSchema extends Record<string, unknown>>(
  db: BetterSQLite3Database<TSchema>,
): void {
  const client = (db as unknown as { $client: Database.Database }).$client;
  const hasJournal = client
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
    )
    .get();
  if (hasJournal) {
    client
      .prepare("UPDATE __drizzle_migrations SET created_at = ? WHERE created_at = ?")
      .run(FIXED_0027_STAMP, BAD_0027_STAMP);
  }
  migrate(db, { migrationsFolder: "./drizzle" });
}
