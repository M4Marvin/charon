import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createCharacter,
  deleteCharacter,
  getCharacter,
  listCharacterCards,
  listCharacters,
  updateCharacter,
} from "@/db/repositories/characters";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { makeTestDb, seedSecondUser, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { chats } from "@/db/schema";

describe("characters repository", () => {
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

    it("preserves the V3 spec when explicitly provided", () => {
      const data = makeCharacterData({ name: "V3" });
      const row = createCharacter(
        {
          id: "char-v3",
          userId,
          name: "V3",
          data,
          spec: "chara_card_v3",
          specVersion: "3.0",
        },
        db,
      );
      expect(row.spec).toBe("chara_card_v3");
      expect(row.specVersion).toBe("3.0");

      // Round-trip the JSON column including the V3 stash under
      // data.extensions._v3. Validates that the column type tolerates
      // the extra V3 fields stored in extensions.
      const fetched = getCharacter(userId, "char-v3", db);
      expect(fetched.spec).toBe("chara_card_v3");
      expect(fetched.specVersion).toBe("3.0");
      const fetchedData = fetched.data as { extensions?: { _v3?: unknown } };
      expect(fetchedData.extensions?._v3).toBeUndefined();
    });

    it("preserves V3 stash data in extensions._v3 on round-trip", () => {
      const data = makeCharacterData({
        name: "V3",
        extensions: {
          talkativeness: 0.5,
          _v3: {
            nickname: "Nicky",
            assets: [{ type: "icon", uri: "ccdefault:", name: "main", ext: "png" }],
          },
        },
      });
      createCharacter(
        { id: "char-stash", userId, name: "V3", data, spec: "chara_card_v3", specVersion: "3.0" },
        db,
      );
      const fetched = getCharacter(userId, "char-stash", db);
      const ext = fetched.data.extensions as Record<string, unknown>;
      expect(ext.talkativeness).toBe(0.5);
      const stash = ext._v3 as Record<string, unknown>;
      expect(stash.nickname).toBe("Nicky");
      expect(stash.assets).toEqual([{ type: "icon", uri: "ccdefault:", name: "main", ext: "png" }]);
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
          imagePath: "uploads/avatars/char-1.png",
        },
        db,
      );
      expect(row.imagePath).toBe("uploads/avatars/char-1.png");
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

  describe("listCharacterCards", () => {
    it("returns empty array when user has no characters", () => {
      expect(listCharacterCards(userId, db)).toEqual([]);
    });

    it("returns enriched fields from character data", () => {
      const data = makeCharacterData({
        tags: ["fantasy", "elf"],
        creator_notes: "A creator note",
        creator: "authorName",
      });
      createCharacter({ id: "char-1", userId, name: "Elara", data }, db);
      const cards = listCharacterCards(userId, db);
      expect(cards).toHaveLength(1);
      const card = cards[0]!;
      expect(card.tags).toEqual(["fantasy", "elf"]);
      expect(card.creatorNotes).toBe("A creator note");
      expect(card.creator).toBe("authorName");
    });

    it("returns chatCount of 0 when character has no chats", () => {
      createCharacter({ id: "char-1", userId, name: "X", data: makeCharacterData() }, db);
      const cards = listCharacterCards(userId, db);
      expect(cards[0]!.chatCount).toBe(0);
    });

    it("returns correct chatCount when character has chats", () => {
      createCharacter({ id: "char-1", userId, name: "X", data: makeCharacterData() }, db);
      const now = new Date();
      db.insert(chats)
        .values({
          id: "chat-1",
          userId,
          characterId: "char-1",
          title: "C1",
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(chats)
        .values({
          id: "chat-2",
          userId,
          characterId: "char-1",
          title: "C2",
          createdAt: now,
          updatedAt: now,
        })
        .run();
      const cards = listCharacterCards(userId, db);
      expect(cards[0]!.chatCount).toBe(2);
    });

    it("sorts by updatedAt descending", async () => {
      createCharacter({ id: "char-1", userId, name: "Older", data: makeCharacterData() }, db);
      await new Promise((r) => setTimeout(r, 10));
      createCharacter({ id: "char-2", userId, name: "Newer", data: makeCharacterData() }, db);
      const cards = listCharacterCards(userId, db);
      expect(cards[0]!.name).toBe("Newer");
      expect(cards[1]!.name).toBe("Older");
    });

    it("returns only the calling user's characters", () => {
      const otherId = seedSecondUser(db);
      createCharacter({ id: "char-1", userId, name: "mine", data: makeCharacterData() }, db);
      createCharacter(
        { id: "char-2", userId: otherId, name: "theirs", data: makeCharacterData() },
        db,
      );
      const cards = listCharacterCards(userId, db);
      expect(cards).toHaveLength(1);
      expect(cards[0]!.id).toBe("char-1");
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
