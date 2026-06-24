import { beforeEach, describe, expect, it } from "vitest";
import {
  createCharacter,
  deleteCharacter,
  getCharacter,
  listCharacters,
  updateCharacter,
} from "@/db/repositories/characters";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { makeTestDb, seedSecondUser, seedTestUser, type TestDb } from "@/db/__tests__/helpers";

describe("characters repository", () => {
  let db: TestDb;
  let userId: string;

  beforeEach(() => {
    const ctx = makeTestDb();
    db = ctx.db;
    userId = seedTestUser(db);
  });

  describe("createCharacter", () => {
    it("inserts a row with all fields and returns it", () => {
      const data = makeCharacterData({ name: "Alice" });
      const row = createCharacter({ id: "char-1", userId, name: "Alice", data }, db);

      expect(row.id).toBe("char-1");
      expect(row.userId).toBe(userId);
      expect(row.name).toBe("Alice");
      expect(row.data).toEqual(data);
      expect(row.spec).toBe("chara_card_v2");
      expect(row.specVersion).toBe("2.0");
      expect(row.imagePath).toBeNull();
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);
    });

    it("round-trips nested JSON data column", () => {
      const data = makeCharacterData({
        alternate_greetings: ["hi", "hey"],
        character_book: {
          extensions: {},
          entries: [],
        },
      });
      createCharacter({ id: "char-1", userId, name: "X", data }, db);
      const fetched = getCharacter(userId, "char-1", db);
      expect(fetched.data).toEqual(data);
    });

    it("stores imagePath when provided", () => {
      const row = createCharacter(
        {
          id: "char-1",
          userId,
          name: "X",
          data: makeCharacterData(),
          imagePath: "data/avatars/char-1.png",
        },
        db,
      );
      expect(row.imagePath).toBe("data/avatars/char-1.png");
    });
  });

  describe("getCharacter", () => {
    beforeEach(() => {
      createCharacter({ id: "char-1", userId, name: "A", data: makeCharacterData() }, db);
    });

    it("returns the character for the owning user", () => {
      const row = getCharacter(userId, "char-1", db);
      expect(row.id).toBe("char-1");
    });

    it("throws when id does not exist", () => {
      expect(() => getCharacter(userId, "missing", db)).toThrow("Character not found");
    });

    it("throws when accessed by a different user", () => {
      const otherId = seedSecondUser(db);
      expect(() => getCharacter(otherId, "char-1", db)).toThrow("Character not found");
    });
  });

  describe("listCharacters", () => {
    it("returns an empty array when user has no characters", () => {
      expect(listCharacters(userId, db)).toEqual([]);
    });

    it("returns only the calling user's characters", () => {
      const otherId = seedSecondUser(db);
      createCharacter({ id: "char-1", userId, name: "mine", data: makeCharacterData() }, db);
      createCharacter(
        {
          id: "char-2",
          userId: otherId,
          name: "theirs",
          data: makeCharacterData(),
        },
        db,
      );
      const mine = listCharacters(userId, db);
      expect(mine).toHaveLength(1);
      expect(mine[0]?.id).toBe("char-1");
    });
  });

  describe("updateCharacter", () => {
    beforeEach(() => {
      createCharacter(
        {
          id: "char-1",
          userId,
          name: "Old",
          data: makeCharacterData({ name: "Old" }),
        },
        db,
      );
    });

    it("applies a partial patch and bumps updatedAt", async () => {
      const before = getCharacter(userId, "char-1", db);
      await new Promise((r) => setTimeout(r, 5));
      const updated = updateCharacter(userId, "char-1", { name: "New" }, db);
      expect(updated.name).toBe("New");
      expect(updated.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
      expect(updated.createdAt.getTime()).toBe(before.createdAt.getTime());
    });

    it("replaces the data column with new JSON", () => {
      const newData = makeCharacterData({
        description: "updated",
        alternate_greetings: ["yo"],
      });
      const updated = updateCharacter(userId, "char-1", { data: newData }, db);
      expect(updated.data).toEqual(newData);
    });

    it("throws when character does not exist for the user", () => {
      expect(() => updateCharacter(userId, "missing", { name: "x" }, db)).toThrow(
        "Character not found",
      );
    });

    it("throws when patch targets another user's character", () => {
      const otherId = seedSecondUser(db);
      expect(() => updateCharacter(otherId, "char-1", { name: "x" }, db)).toThrow(
        "Character not found",
      );
    });
  });

  describe("deleteCharacter", () => {
    beforeEach(() => {
      createCharacter({ id: "char-1", userId, name: "X", data: makeCharacterData() }, db);
    });

    it("removes the row", () => {
      deleteCharacter(userId, "char-1", db);
      expect(() => getCharacter(userId, "char-1", db)).toThrow("Character not found");
    });

    it("throws when character does not exist", () => {
      expect(() => deleteCharacter(userId, "missing", db)).toThrow("Character not found");
    });

    it("throws when deleting another user's character", () => {
      const otherId = seedSecondUser(db);
      expect(() => deleteCharacter(otherId, "char-1", db)).toThrow("Character not found");
    });
  });
});
