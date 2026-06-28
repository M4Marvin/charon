import { eq } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import { backgrounds, type Background } from "@/db/schema";

export type CreateBackgroundInput = {
  name: string;
  path: string;
};

export function listBackgrounds(db: DB = defaultDb): Background[] {
  return db.select().from(backgrounds).all();
}

export function getBackground(id: string, db: DB = defaultDb): Background {
  const row = db
    .select()
    .from(backgrounds)
    .where(eq(backgrounds.id, id))
    .get();
  if (!row) throw new Error("Background not found");
  return row;
}

export function createBackground(
  input: CreateBackgroundInput,
  db: DB = defaultDb,
): Background {
  const now = new Date();
  const row = db
    .insert(backgrounds)
    .values({
      name: input.name,
      path: input.path,
      createdAt: now,
    })
    .returning()
    .get();
  if (!row) throw new Error("Failed to create background");
  return row;
}

export function deleteBackground(id: string, db: DB = defaultDb): void {
  const result = db
    .delete(backgrounds)
    .where(eq(backgrounds.id, id))
    .run();
  if (result.changes === 0) throw new Error("Background not found");
}
