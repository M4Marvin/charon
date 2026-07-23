import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTestDb, seedTestUser, seedSecondUser, type TestDb, type TestSqlite } from "@/db/__tests__/helpers";
import { listUsers, deleteUser, countAdmins } from "@/db/repositories/users";
import { createCharacter } from "@/db/repositories/characters";
import { createPersona } from "@/db/repositories/personas";
import { upsertUserSettings } from "@/db/repositories/userSettings";
import { user, characters, userSettings } from "@/db/schema";

describe("users repository", () => {
  let db: TestDb;
  let sqlite: TestSqlite;

  beforeEach(() => {
    const ctx = makeTestDb();
    db = ctx.db;
    sqlite = ctx.sqlite;
  });

  afterEach(() => {
    sqlite.close();
  });

  describe("listUsers", () => {
    it("returns all users ordered by createdAt asc", () => {
      const u1 = seedTestUser(db, "user-a");
      const u2 = seedSecondUser(db, "user-b");
      const users = listUsers(db);
      expect(users.map((u) => u.id)).toEqual([u1, u2]);
      expect(users[0].role).toBe("user");
    });

    it("returns empty array when no users exist", () => {
      expect(listUsers(db)).toEqual([]);
    });
  });

  describe("countAdmins", () => {
    it("returns 0 when no admins exist", () => {
      seedTestUser(db);
      expect(countAdmins(db)).toBe(0);
    });

    it("counts admin users only", () => {
      seedTestUser(db, "user-1");
      db.update(user).set({ role: "admin" }).where(eq(user.id, "user-1")).run();
      seedSecondUser(db, "user-2");
      expect(countAdmins(db)).toBe(1);
    });
  });

  describe("deleteUser", () => {
    it("removes the user row", () => {
      const userId = seedTestUser(db);
      expect(listUsers(db)).toHaveLength(1);
      deleteUser(userId, db);
      expect(listUsers(db)).toHaveLength(0);
    });

    it("cascades to domain tables", () => {
      const userId = seedTestUser(db);

      createCharacter(
        {
          id: "char-1",
          userId,
          name: "Test Char",
          data: {
            name: "Test Char",
            description: "",
            personality: "",
            scenario: "",
            first_mes: "",
            mes_example: "",
            creator_notes: "",
            system_prompt: "",
            post_history_instructions: "",
            alternate_greetings: [],
            tags: [],
            creator: "",
            character_version: "1",
            extensions: {},
          },
        },
        db,
      );

      createPersona({ id: "pers-1", userId, name: "Persona" }, db);
      upsertUserSettings(userId, { systemPrompt: "test" }, db);

      deleteUser(userId, db);

      expect(listUsers(db)).toHaveLength(0);

      const charRow = db.select().from(characters).where(eq(characters.userId, userId)).get();
      expect(charRow).toBeUndefined();

      const settings = db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
      expect(settings).toBeUndefined();
    });

    it("throws on unknown user id", () => {
      expect(() => deleteUser("nonexistent", db)).toThrow("User not found");
    });
  });
});
