// QA fixture for the migrate-to-single-user operator (scripts/migrate-to-single-user.ts).
// Spawns the operator as a child (so @/db initializes there, not here) against scratch
// DBs under os.tmpdir(). Never touches the real dev.db or drizzle/.
// Run with: pnpm exec tsx scripts/__fixtures__/migrate-to-single-user.qa.ts

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const OPERATOR = "scripts/migrate-to-single-user.ts";

function runOperator(dbUrl: string): { status: number | null; out: string } {
  const res = spawnSync("pnpm", ["exec", "tsx", OPERATOR], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: dbUrl },
    encoding: "utf8",
  });
  return { status: res.status, out: `${res.stdout}\n${res.stderr}` };
}

/** Backup files for <dbFile> present in <dir> (sorted for stable comparison). */
function backupsFor(dir: string, dbFile: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.startsWith(`${dbFile}.bak-single-user-`))
    .sort();
}

// 1. Missing DB → refusal with a nonzero exit.
function scenarioMissingDb(dir: string): void {
  const missing = join(dir, "does-not-exist.db");
  const { status, out } = runOperator(missing);
  assert.notEqual(status, 0, `missing DB must exit nonzero, got ${status}:\n${out}`);
  assert.match(out, /DATABASE_URL/);
  assert.match(out, /does not exist/i);
  console.log("  PASS 1: missing DB refused (nonzero, names DATABASE_URL)");
}

// 2. Fresh DB → backup created BEFORE migrate, then migrations applied.
function scenarioFreshDb(dir: string): string {
  const dbPath = join(dir, "fresh.db");
  new Database(dbPath).close(); // empty but valid sqlite file

  const before = backupsFor(dir, "fresh.db");
  assert.equal(before.length, 0);

  const { status, out } = runOperator(dbPath);
  assert.equal(status, 0, `fresh-DB operator failed (${status}):\n${out}`);

  const backups = backupsFor(dir, "fresh.db");
  assert.equal(backups.length, 1, `expected exactly one backup, got ${backups.length}`);
  const backupMtime = statSync(join(dir, backups[0])).mtimeMs;
  const dbMtime = statSync(dbPath).mtimeMs;
  assert.ok(
    backupMtime <= dbMtime,
    `backup (${backupMtime}) must predate migrated DB (${dbMtime})`,
  );

  // Migrations actually applied to the scratch DB.
  const sqlite = new Database(dbPath, { readonly: true });
  try {
    const { c } = sqlite.prepare("SELECT count(*) AS c FROM __drizzle_migrations").get() as {
      c: number;
    };
    assert.ok(c > 0, `expected applied migrations, __drizzle_migrations has ${c} rows`);
  } finally {
    sqlite.close();
  }

  assert.match(out, /applied \d+ migration/);
  console.log("  PASS 2: fresh DB → backup before migrate + migrations applied");
  return dbPath;
}

// 3. Re-run → already-migrated no-op; no second backup appears.
function scenarioAlreadyMigrated(dir: string, dbPath: string): void {
  const before = backupsFor(dir, "fresh.db");

  const { status, out } = runOperator(dbPath);
  assert.equal(status, 0, `re-run failed (${status}):\n${out}`);
  assert.match(out, /already migrated/);

  const after = backupsFor(dir, "fresh.db");
  assert.deepEqual(after, before, "re-run must not create a second backup");
  console.log("  PASS 3: already-migrated re-run → no-op, no second backup");
}

const dir = mkdtempSync(join(tmpdir(), "migrate-single-user-qa-"));
try {
  console.log("migrate-to-single-user operator QA");
  scenarioMissingDb(dir);
  const dbPath = scenarioFreshDb(dir);
  scenarioAlreadyMigrated(dir, dbPath);
  console.log("\nPASS: migrate-to-single-user operator QA");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
