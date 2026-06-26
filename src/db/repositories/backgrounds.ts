import { and, eq } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import { backgrounds, type Background } from "@/db/schema";

export type CreateBackgroundInput = {
  name: string;
  path: string;
};

export function listBackgrounds(userId: string, db: DB = defaultDb): Background[] {
  return db.select().from(backgrounds).where(eq(backgrounds.userId, userId)).all();
}

export function getBackground(userId: string, id: string, db: DB = defaultDb): Background {
  const row = db
    .select()
    .from(backgrounds)
    .where(and(eq(backgrounds.id, id), eq(backgrounds.userId, userId)))
    .get();
  if (!row) throw new Error("Background not found");
  return row;
}

export function createBackground(
  userId: string,
  input: CreateBackgroundInput,
  db: DB = defaultDb,
): Background {
  const now = new Date();
  const row = db
    .insert(backgrounds)
    .values({
      userId,
      name: input.name,
      path: input.path,
      createdAt: now,
    })
    .returning()
    .get();
  if (!row) throw new Error("Failed to create background");
  return row;
}

export function deleteBackground(userId: string, id: string, db: DB = defaultDb): void {
  const result = db
    .delete(backgrounds)
    .where(and(eq(backgrounds.id, id), eq(backgrounds.userId, userId)))
    .run();
  if (result.changes === 0) throw new Error("Background not found");
}
