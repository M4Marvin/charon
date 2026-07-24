import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTestDb, seedSecondUser, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import {
  createPersona,
  deletePersona,
  getPersona,
  listPersonas,
  updatePersona,
} from "@/db/repositories/personas";

describe("personas repository", () => {
  let db: TestDb;
  let userId: string;

  let ctx: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    ctx = makeTestDb();
    db = ctx.db;
    userId = seedTestUser(db);
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  describe("createPersona", () => {
    it("inserts a row with required fields and returns it", () => {
      const row = createPersona({ id: "p-1", userId, name: "Default" }, db);
      expect(row.id).toBe("p-1");
      expect(row.userId).toBe(userId);
      expect(row.name).toBe("Default");
      expect(row.description).toBeNull();
      expect(row.iconPath).toBeNull();
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);
    });

    it("stores description and iconPath when provided", () => {
      const row = createPersona(
        {
          id: "p-1",
          userId,
          name: "Alice",
          description: "A brave hero",
          iconPath: "uploads/personas/alice.png",
        },
        db,
      );
      expect(row.description).toBe("A brave hero");
      expect(row.iconPath).toBe("uploads/personas/alice.png");
    });
  });

  describe("getPersona", () => {
    it("throws when accessed by a different user", () => {
      const otherId = seedSecondUser(db);
      createPersona({ id: "p-1", userId, name: "X" }, db);
      expect(() => getPersona(otherId, "p-1", db)).toThrow("Persona not found");
    });

    it("throws when persona does not exist", () => {
      expect(() => getPersona(userId, "missing", db)).toThrow("Persona not found");
    });
  });

  describe("listPersonas", () => {
    it("returns an empty array when user has no personas", () => {
      expect(listPersonas(userId, db)).toEqual([]);
    });

    it("returns only the calling user's personas, ordered by name", () => {
      const otherId = seedSecondUser(db);
      createPersona({ id: "p-1", userId, name: "Bravo" }, db);
      createPersona({ id: "p-2", userId, name: "Alpha" }, db);
      createPersona({ id: "p-3", userId: otherId, name: "Other" }, db);
      const mine = listPersonas(userId, db);
      expect(mine).toHaveLength(2);
      expect(mine.map((p) => p.name)).toEqual(["Alpha", "Bravo"]);
    });
  });

  describe("updatePersona", () => {
    beforeEach(() => {
      createPersona({ id: "p-1", userId, name: "Old", description: "old desc" }, db);
    });

    it("updates name and description", () => {
      const updated = updatePersona(userId, "p-1", { name: "New", description: "new desc" }, db);
      expect(updated.name).toBe("New");
      expect(updated.description).toBe("new desc");
    });

    it("sets description to null when explicitly cleared", () => {
      const updated = updatePersona(userId, "p-1", { description: null }, db);
      expect(updated.description).toBeNull();
    });

    it("leaves untouched fields alone", () => {
      const updated = updatePersona(userId, "p-1", { name: "Renamed" }, db);
      expect(updated.description).toBe("old desc");
    });

    it("throws when accessed by a different user", () => {
      const otherId = seedSecondUser(db);
      expect(() => updatePersona(otherId, "p-1", { name: "X" }, db)).toThrow("Persona not found");
    });
  });

  describe("deletePersona", () => {
    it("removes the row", () => {
      createPersona({ id: "p-1", userId, name: "X" }, db);
      expect(listPersonas(userId, db)).toHaveLength(1);
      deletePersona(userId, "p-1", db);
      expect(listPersonas(userId, db)).toEqual([]);
    });

    it("throws when accessed by a different user", () => {
      const otherId = seedSecondUser(db);
      createPersona({ id: "p-1", userId, name: "X" }, db);
      expect(() => deletePersona(otherId, "p-1", db)).toThrow("Persona not found");
    });
  });
});
