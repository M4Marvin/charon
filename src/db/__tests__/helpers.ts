import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrateWithStampRepair } from "@/db/migrate";
import * as schema from "@/db/schema";
import { user } from "@/db/schema";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;
export type TestSqlite = ReturnType<typeof Database>;

export function makeTestDb(): { db: TestDb; sqlite: TestSqlite } {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  // Mirror src/db/index.ts: migrations rebuild tables, so they run with FK
  // enforcement off, then it is re-enabled for the test body. The
  // single_account_admission trigger stays in place — exactly one user row.
  sqlite.pragma("foreign_keys = OFF");
  try {
    migrateWithStampRepair(db);
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
  return { db, sqlite };
}

export function seedTestUser(db: TestDb, id = "user-1"): string {
  const now = new Date();
  db.insert(user)
    .values({
      id,
      name: "Test User",
      email: `${id}@test.local`,
      username: id,
      displayUsername: id,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}
