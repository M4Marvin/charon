import { and, eq } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import { characters, type Character, type NewCharacter } from "@/db/schema";
import type { CharacterDataV2 } from "@/lib/st-core/character";

export type CreateCharacterInput = {
  id: string;
  userId: string;
  name: string;
  data: CharacterDataV2;
  imagePath?: string | null;
};

export function listCharacters(userId: string, db: DB = defaultDb): Character[] {
  return db.select().from(characters).where(eq(characters.userId, userId)).all();
}

export function getCharacter(userId: string, id: string, db: DB = defaultDb): Character {
  const row = db
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .get();
  if (!row) throw new Error("Character not found");
  return row;
}

export function createCharacter(input: CreateCharacterInput, db: DB = defaultDb): Character {
  const now = new Date();
  const row = db
    .insert(characters)
    .values({
      id: input.id,
      userId: input.userId,
      name: input.name,
      data: input.data,
      imagePath: input.imagePath ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  if (!row) throw new Error("Failed to create character");
  return row;
}

export function updateCharacter(
  userId: string,
  id: string,
  patch: Partial<Pick<NewCharacter, "name" | "data" | "spec" | "specVersion" | "imagePath">>,
  db: DB = defaultDb,
): Character {
  const row = db
    .update(characters)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .returning()
    .get();
  if (!row) throw new Error("Character not found");
  return row;
}

export function deleteCharacter(userId: string, id: string, db: DB = defaultDb): void {
  const result = db
    .delete(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .run();
  if (result.changes === 0) throw new Error("Character not found");
}
