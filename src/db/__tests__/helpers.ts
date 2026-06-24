import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/db/schema";
import { user } from "@/db/schema";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;
export type TestSqlite = ReturnType<typeof Database>;

export function makeTestDb(): { db: TestDb; sqlite: TestSqlite } {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return { db, sqlite };
}

export function seedTestUser(db: TestDb, id = "user-1"): string {
  const now = new Date();
  db.insert(user)
    .values({
      id,
      name: "Test User",
      email: `${id}@test.local`,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

export function seedSecondUser(db: TestDb, id = "user-2"): string {
  const now = new Date();
  db.insert(user)
    .values({
      id,
      name: "Other User",
      email: `${id}@test.local`,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}
