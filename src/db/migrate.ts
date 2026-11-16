import type Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "node:fs";

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

/**
 * Detect migrations the ceiling rule silently skipped: a journal entry whose
 * `when` is below the newest recorded value but which has no journal row was
 * filtered out and never applied, so its schema changes are missing. The live
 * examples are 0008/0012's anomalous stamps (0008 is future-dated above
 * 0009–0012; see CONTRIBUTING.md "Migration journal rules").
 *
 * Detection only: a skipped migration can carry data-copying SQL, so
 * replaying it is a deliberate operator action, not something to auto-run at
 * boot.
 */
function warnOnSkippedMigrations(client: Database.Database): void {
  const rows = client.prepare("SELECT created_at FROM __drizzle_migrations").all() as {
    created_at: number;
  }[];
  if (rows.length === 0) return;
  const ceiling = Math.max(...rows.map((r) => r.created_at));
  const recorded = new Set(rows.map((r) => r.created_at));
  // readMigrationFiles (drizzle-orm/migrator) is the version-tied source for
  // which migrations exist and how they are stamped; the journal JSON only
  // labels the skipped stamps with their tags for the operator.
  const tags = new Map<number, string>(
    (
      JSON.parse(readFileSync("./drizzle/meta/_journal.json", "utf8")) as {
        entries: { tag: string; when: number }[];
      }
    ).entries.map((e) => [e.when, e.tag]),
  );
  const skipped = readMigrationFiles({ migrationsFolder: "./drizzle" })
    .filter((m) => m.folderMillis < ceiling && !recorded.has(m.folderMillis))
    .map((m) => tags.get(m.folderMillis) ?? String(m.folderMillis));
  if (skipped.length > 0) {
    console.warn(
      `[migrate] ${skipped.length} migration(s) were skipped by the journal ceiling rule and were never applied: ` +
        `${skipped.join(", ")}. Their schema changes are missing — see CONTRIBUTING.md ` +
        `"Migration journal rules" for how to repair before using this database.`,
    );
  }
}

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
  // On a fresh database the journal table only now exists; detection works
  // there too (everything is recorded, so it stays silent).
  warnOnSkippedMigrations(client);
}
