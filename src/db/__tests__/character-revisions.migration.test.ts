import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { migrateWithStampRepair } from "@/db/migrate";
import * as schema from "@/db/schema";

/**
 * The runtime test DB migrates from scratch, so hand-written backfill SQL
 * (0027/0028) only ever runs against zero rows in CI. This harness replays
 * the journal up to a chosen tag with pre-existing data in place, then hands
 * off to the real migrator — reproducing what an actual upgrade sees.
 *
 * The migration list comes from drizzle's own reader, so a drizzle upgrade
 * that changes statement splitting or journal hashing updates this harness
 * with it. Only the stop-at-tag logic is custom; the journal rows carry the
 * sha256 of the raw file content, exactly how the migrator keys them.
 */
function migrateUpTo(sqlite: Database.Database, throughTag: string): void {
  const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
  // Exact DDL the migrator uses for its journal table.
  sqlite.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at numeric
  )`);
  const stopHash = createHash("sha256")
    .update(readFileSync(`drizzle/${throughTag}.sql`, "utf8"))
    .digest("hex");
  for (const migration of migrations) {
    for (const statement of migration.sql) {
      if (statement.trim()) sqlite.exec(statement);
    }
    sqlite
      .prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
      .run(migration.hash, migration.folderMillis);
    if (migration.hash === stopHash) return;
  }
  throw new Error(`Journal has no entry ${throughTag}`);
}

/** Run the production migrator with FK enforcement off, like src/db/index.ts. */
function runRealMigrate(sqlite: Database.Database): void {
  const db = drizzle(sqlite, { schema });
  sqlite.pragma("foreign_keys = OFF");
  try {
    migrateWithStampRepair(db);
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
}

type RawCharacter = {
  id: string;
  name: string;
  data: string;
  spec: string;
  spec_version: string;
  tagline: string | null;
  updated_at: number;
};

function insertPreExistingCharacter(
  sqlite: Database.Database,
  c: Pick<
    RawCharacter,
    "id" | "name" | "data" | "spec" | "spec_version" | "tagline" | "updated_at"
  >,
): void {
  sqlite
    .prepare(
      `INSERT INTO characters (id, name, data, spec, spec_version, tagline, creator, creator_notes, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '', '', '[]', ?, ?)`,
    )
    .run(c.id, c.name, c.data, c.spec, c.spec_version, c.tagline, c.updated_at - 1, c.updated_at);
}

function revisionRows(sqlite: Database.Database): Record<string, unknown>[] {
  return sqlite
    .prepare("SELECT * FROM character_revisions ORDER BY character_id, rev")
    .all() as Record<string, unknown>[];
}

describe("0027/0028 backfills against pre-existing data", () => {
  it("0027 seeds revision 1 per existing character; 0028 adopts the character's spec", () => {
    const sqlite = new Database(":memory:") as Database.Database;
    sqlite.pragma("foreign_keys = OFF");
    migrateUpTo(sqlite, "0026_drop_generation_result");

    const v2Data = JSON.stringify({
      name: "Aria",
      description: "V2 card",
      first_mes: "Hello",
    });
    const v3Data = JSON.stringify({ name: "Boreas", description: "V3 card" });
    insertPreExistingCharacter(sqlite, {
      id: "char-a",
      name: "Aria",
      data: v2Data,
      spec: "chara_card_v2",
      spec_version: "2.0",
      tagline: "Wind mage",
      updated_at: 1700000000000,
    });
    insertPreExistingCharacter(sqlite, {
      id: "char-b",
      name: "Boreas",
      data: v3Data,
      spec: "chara_card_v3",
      spec_version: "3.0",
      tagline: null,
      updated_at: 1700000001000,
    });
    sqlite.pragma("foreign_keys = ON");

    runRealMigrate(sqlite);

    const rows = revisionRows(sqlite);
    expect(rows).toHaveLength(2);
    const a = rows.find((r) => r.character_id === "char-a") as Record<string, unknown>;
    const b = rows.find((r) => r.character_id === "char-b") as Record<string, unknown>;
    for (const [row, char, data] of [
      [a, "char-a", v2Data],
      [b, "char-b", v3Data],
    ] as const) {
      expect(row.rev).toBe(1);
      expect(row.data).toBe(data); // raw text copied verbatim (mode:"json" round-trips identically)
      expect(row.created_at).toBe(
        (
          sqlite.prepare("SELECT updated_at FROM characters WHERE id = ?").get(char) as {
            updated_at: number;
          }
        ).updated_at,
      );
    }
    expect(a.name).toBe("Aria");
    expect(a.tagline).toBe("Wind mage");
    expect(a.spec).toBe("chara_card_v2");
    expect(a.spec_version).toBe("2.0");
    expect(b.name).toBe("Boreas");
    expect(b.tagline).toBeNull();
    expect(b.spec).toBe("chara_card_v3"); // V3 rows keep their spec identity
    expect(b.spec_version).toBe("3.0");
  });

  it("0028 backfill tolerates a dangling revision row (COALESCE, not a hard NOT NULL failure)", () => {
    const sqlite = new Database(":memory:") as Database.Database;
    migrateUpTo(sqlite, "0027_character_revisions");

    // 0027's backfill already ran; add a revision whose character no longer
    // exists (possible when FK enforcement was off across an interrupted
    // upgrade). Pre-fix this hard-failed: NOT NULL constraint failed spec.
    // Some migration files re-enable FKs as their final statement, so the
    // pragma must be re-issued after replay, not just before it.
    sqlite.pragma("foreign_keys = OFF");
    sqlite
      .prepare(
        `INSERT INTO character_revisions (id, character_id, rev, name, tagline, data, created_at)
         VALUES ('orphan', 'ghost', 3, 'Ghost', NULL, '{}', 0)`,
      )
      .run();
    sqlite.pragma("foreign_keys = ON");

    expect(() => runRealMigrate(sqlite)).not.toThrow();

    const rows = sqlite
      .prepare("SELECT character_id, rev, spec, spec_version FROM character_revisions")
      .all() as { character_id: string; rev: number; spec: string; spec_version: string }[];
    const orphan = rows.find((r) => r.character_id === "ghost");
    expect(orphan).toMatchObject({ spec: "chara_card_v2", spec_version: "2.0" });
  });
});
