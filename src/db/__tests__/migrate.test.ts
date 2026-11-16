import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it, vi, afterEach } from "vitest";
import { migrateWithStampRepair } from "@/db/migrate";
import * as schema from "@/db/schema";

const BAD_0027_STAMP = 1797336000000;
const FIXED_0027_STAMP = 1794652121346;
const STAMP_0028 = 1794680866045;
const STAMP_0029 = 1794830227853;

function journalRows(sqlite: Database.Database): { hash: string; created_at: number }[] {
  return sqlite
    .prepare("SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at ASC")
    .all() as { hash: string; created_at: number }[];
}

/** Migrate a fresh DB through every shipped migration. */
function migrateFresh(sqlite: Database.Database): void {
  const db = drizzle(sqlite, { schema });
  sqlite.pragma("foreign_keys = OFF");
  try {
    migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
}

/** Run the repair exactly like production does (FK off during migrations). */
function runRepair(sqlite: Database.Database): void {
  const db = drizzle(sqlite, { schema });
  sqlite.pragma("foreign_keys = OFF");
  try {
    migrateWithStampRepair(db);
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
}

describe("migrateWithStampRepair", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("repairs a database that applied 0027 under the future stamp, so 0028 applies", () => {
    const sqlite = new Database(":memory:") as Database.Database;
    migrateFresh(sqlite);

    // Simulate the pre-repair affected state: 0027 was applied while the
    // journal still carried the future stamp, so its recorded ceiling is
    // above 0028's `when`; 0028 was skipped. Undo 0028's effects and journal
    // row (and 0029's row — no affected DB can have recorded a migration
    // shipped after the repair), and stamp the 0027 record with the bad
    // value.
    sqlite.exec("ALTER TABLE character_revisions DROP COLUMN spec");
    sqlite.exec("ALTER TABLE character_revisions DROP COLUMN spec_version");
    sqlite.prepare("DELETE FROM __drizzle_migrations WHERE created_at = ?").run(STAMP_0028);
    sqlite.prepare("DELETE FROM __drizzle_migrations WHERE created_at = ?").run(STAMP_0029);
    sqlite
      .prepare("UPDATE __drizzle_migrations SET created_at = ? WHERE created_at = ?")
      .run(BAD_0027_STAMP, FIXED_0027_STAMP);

    runRepair(sqlite);

    // 0028 applied: the spec columns exist again and are recorded.
    const columns = sqlite.prepare("PRAGMA table_info(character_revisions)").all() as {
      name: string;
    }[];
    expect(columns.map((c) => c.name)).toContain("spec");
    expect(columns.map((c) => c.name)).toContain("spec_version");
    const rows = journalRows(sqlite);
    // 0028 applied (its schema was asserted above); the repair also rewrote
    // the recorded bad stamp away.
    expect(rows.some((r) => r.created_at === STAMP_0028)).toBe(true);
    expect(rows.filter((r) => r.created_at === BAD_0027_STAMP)).toHaveLength(0);
  });

  it("is a no-op on a correctly-migrated database", () => {
    const sqlite = new Database(":memory:") as Database.Database;
    migrateFresh(sqlite);
    const before = journalRows(sqlite);

    runRepair(sqlite);

    expect(journalRows(sqlite)).toEqual(before);
  });

  it("migrates a fresh database without a journal table", () => {
    const sqlite = new Database(":memory:") as Database.Database;

    runRepair(sqlite);

    const rows = journalRows(sqlite);
    expect(rows.length).toBeGreaterThanOrEqual(29);
    expect(rows.at(-1)).toMatchObject({ created_at: STAMP_0029 });
  });

  it("warns when the ceiling rule skipped a migration (0008/0012-style stamp anomaly)", () => {
    const sqlite = new Database(":memory:") as Database.Database;
    migrateFresh(sqlite);

    // Simulate the affected shape: 0008 applied under its future-dated stamp,
    // so every migration stamped below it (0009–0012) was filtered out. Drop
    // only their journal rows — the migrator will still skip them on the
    // next run because the ceiling above them remains recorded.
    const skippedStamps = [1782744613212, 1782772759724, 1782772759725, 1752852000000];
    for (const stamp of skippedStamps) {
      sqlite.prepare("DELETE FROM __drizzle_migrations WHERE created_at = ?").run(stamp);
    }
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    runRepair(sqlite);

    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0]?.[0] as string;
    for (const tag of [
      "0009_furry_wasp",
      "0010_colossal_fallen_one",
      "0011_global_provider_nullable",
      "0012_per_chat_character_fields",
    ]) {
      expect(message).toContain(tag);
    }
    expect(message).toContain("Migration journal rules");
  });

  it("stays silent on a healthy database", () => {
    const sqlite = new Database(":memory:") as Database.Database;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    runRepair(sqlite);

    expect(warn).not.toHaveBeenCalled();
  });
});
