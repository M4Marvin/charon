// Single-user migration operator.
// Backs up the DB (with -wal/-shm sidecars) BEFORE applying pending migrations via
// @/db — the same lazy migrator production uses — then reports what it did.
// Run with: pnpm migrate:single-user  (point DATABASE_URL at the sqlite file if not dev.db)

import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database, { type Database as SqliteDatabase } from "better-sqlite3";

import { db, type DB } from "@/db";

const MIGRATIONS_JOURNAL = join("drizzle", "meta", "_journal.json");
const TRIGGER_NAME = "single_account_admission";

function localStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function uniqueBackupPath(dbPath: string): string {
  const base = `${dbPath}.bak-single-user-${localStamp()}`;
  let candidate = base;
  for (let i = 1; existsSync(candidate); i++) candidate = `${base}-${i}`;
  return candidate;
}

/** Migrations the drizzle journal knows about (the repo's migration set). */
function journalMigrations(): number {
  const raw = JSON.parse(readFileSync(MIGRATIONS_JOURNAL, "utf8")) as { entries: unknown[] };
  return raw.entries.length;
}

/** Migrations already applied to the target DB (0 when never migrated). */
function appliedMigrations(dbPath: string): number {
  const sqlite = new Database(dbPath, { readonly: true });
  try {
    const row = sqlite.prepare("SELECT count(*) AS c FROM __drizzle_migrations").get() as {
      c: number;
    };
    return row.c;
  } catch {
    return 0; // __drizzle_migrations doesn't exist yet → never migrated
  } finally {
    sqlite.close();
  }
}

async function main(): Promise<void> {
  console.log("=== single-user migration operator ===\n");

  const dbPath = process.env.DATABASE_URL;
  if (!dbPath) {
    console.error("DATABASE_URL is required (e.g. DATABASE_URL=dev.db or a path)");
    process.exit(1);
  }
  if (!existsSync(dbPath)) {
    console.error(`database file not found: ${dbPath}`);
    console.error("DATABASE_URL points to a file that does not exist");
    process.exit(1);
  }

  const pending = Math.max(0, journalMigrations() - appliedMigrations(dbPath));

  // Backup BEFORE migrating — only when there is something to apply.
  if (pending > 0) {
    const backupPath = uniqueBackupPath(dbPath);
    copyFileSync(dbPath, backupPath);
    for (const suffix of ["-wal", "-shm"]) {
      const sidecar = `${dbPath}${suffix}`;
      if (existsSync(sidecar)) copyFileSync(sidecar, `${backupPath}${suffix}`);
    }
    console.log(`backup: ${backupPath}`);
  } else {
    console.log("backup: skipped (no pending migrations — DB is already at the latest schema)");
  }

  // Touch the lazy @/db proxy → it runs drizzle(...) + migrate(...) exactly like
  // production. This is the ONLY migration path; nothing is reimplemented here.
  // ($client is on drizzle()'s return type, not on the exported DB class type.)
  const client = (db as DB & { $client: SqliteDatabase }).$client;

  console.log(`pending migrations: ${pending}`);
  if (pending > 0) console.log(`migrate: applied ${pending} migration(s)`);
  else console.log("migrate: already migrated — re-running is a no-op");

  // Read-only post-0021 report: does the single-account guard trigger exist?
  const trigger = client
    .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = ?")
    .get(TRIGGER_NAME);
  if (trigger) {
    const { c } = client.prepare("SELECT count(*) AS c FROM user").get() as { c: number };
    console.log(`schema: post-0021 (${TRIGGER_NAME} trigger present)`);
    console.log(`remaining users: ${c}`);
  } else {
    console.log(`schema: pre-0021 (${TRIGGER_NAME} trigger absent)`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
