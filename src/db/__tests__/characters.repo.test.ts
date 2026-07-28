import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createCharacter,
  deleteCharacter,
  getCharacter,
  listCharacterCards,
  listCharacters,
  searchCharacterCards,
  characterTagCounts,
  derivedColumns,
  updateCharacter,
} from "@/db/repositories/characters";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { makeTestDb, seedSecondUser, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { chats } from "@/db/schema";
import type { CharacterDataV2 } from "@/lib/st-core/character";

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

  describe("derivedColumns", () => {
    it("extracts creator, creator_notes, tags from data", () => {
      const data = makeCharacterData({
        creator: "author",
        creator_notes: "notes",
        tags: ["a", "b"],
      });
      expect(derivedColumns(data)).toEqual({
        creator: "author",
        creatorNotes: "notes",
        tags: ["a", "b"],
      });
    });

    it("defaults missing fields to empty strings / array", () => {
      const minimal = makeCharacterData({
        creator: undefined,
        creator_notes: undefined,
        tags: undefined,
      } as Partial<CharacterDataV2>);
      expect(derivedColumns(minimal).creator).toBe("");
      expect(derivedColumns(minimal).creatorNotes).toBe("");
      expect(derivedColumns(minimal).tags).toEqual([]);
    });
  });

  describe("createCharacter with derivedColumns", () => {
    it("populates denormalized columns on write", () => {
      const data = makeCharacterData({
        creator: "author",
        creator_notes: "notes",
        tags: ["fantasy"],
      });
      const row = createCharacter({ id: "char-1", userId, name: "Test", data }, db);
      expect(row.creator).toBe("author");
      expect(row.creatorNotes).toBe("notes");
      expect(row.tags).toEqual(["fantasy"]);
    });
  });

  describe("updateCharacter with derivedColumns", () => {
    it("re-derives columns when data is present in patch", () => {
      const data = makeCharacterData({ creator: "old" });
      createCharacter({ id: "char-1", userId, name: "Test", data }, db);

      const newData = makeCharacterData({ creator: "new", tags: ["elf"] });
      updateCharacter(userId, "char-1", { data: newData, name: newData.name }, db);

      const updated = getCharacter(userId, "char-1", db);
      expect(updated.creator).toBe("new");
      expect(updated.tags).toEqual(["elf"]);
    });

    it("does not touch columns when data is absent from patch", () => {
      const data = makeCharacterData({ creator: "original" });
      createCharacter({ id: "char-1", userId, name: "OldName", data }, db);
      const before = getCharacter(userId, "char-1", db);

      updateCharacter(userId, "char-1", { name: "NewName" }, db);

      const after = getCharacter(userId, "char-1", db);
      expect(after.name).toBe("NewName");
      expect(after.creator).toBe(before.creator);
    });
  });

  describe("searchCharacterCards", () => {
    it("returns empty array when user has no characters", () => {
      const result = searchCharacterCards(userId, { offset: 0, limit: 10 }, db);
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("matches name with case-insensitive LIKE", () => {
      const data = makeCharacterData({ name: "Elara Vance" });
      createCharacter({ id: "char-1", userId, name: "Elara Vance", data }, db);
      const result = searchCharacterCards(userId, { q: "elara", offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.name).toBe("Elara Vance");
    });

    it("matches creator", () => {
      const data = makeCharacterData({ creator: "authorName" });
      createCharacter({ id: "char-1", userId, name: "X", data }, db);
      const result = searchCharacterCards(userId, { q: "author", offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(1);
    });

    it("matches creator_notes", () => {
      const data = makeCharacterData({ creator_notes: "special notes here" });
      createCharacter({ id: "char-1", userId, name: "X", data }, db);
      const result = searchCharacterCards(userId, { q: "special", offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(1);
    });

    it("filters by single tag (AND semantics with one tag)", () => {
      const data = makeCharacterData({ tags: ["fantasy"] });
      createCharacter({ id: "char-1", userId, name: "A", data }, db);
      const result = searchCharacterCards(userId, { tags: ["fantasy"], offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(1);
    });

    it("applies AND semantics for multiple tags", () => {
      createCharacter(
        { id: "char-1", userId, name: "A", data: makeCharacterData({ tags: ["fantasy", "elf"] }) },
        db,
      );
      createCharacter(
        { id: "char-2", userId, name: "B", data: makeCharacterData({ tags: ["fantasy"] }) },
        db,
      );
      const result = searchCharacterCards(
        userId,
        { tags: ["fantasy", "elf"], offset: 0, limit: 10 },
        db,
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.name).toBe("A");
    });

    it("sorts by updatedAt descending (default)", async () => {
      const data = makeCharacterData();
      createCharacter({ id: "char-1", userId, name: "Older", data }, db);
      await new Promise((r) => setTimeout(r, 10));
      createCharacter({ id: "char-2", userId, name: "Newer", data }, db);
      const result = searchCharacterCards(userId, { offset: 0, limit: 10 }, db);
      expect(result.items[0]!.name).toBe("Newer");
      expect(result.items[1]!.name).toBe("Older");
    });

    it("sorts by name ascending", () => {
      createCharacter(
        { id: "char-1", userId, name: "Zelda", data: makeCharacterData() },
        db,
      );
      createCharacter(
        { id: "char-2", userId, name: "Alice", data: makeCharacterData() },
        db,
      );
      const result = searchCharacterCards(
        userId,
        { sort: "name-asc", offset: 0, limit: 10 },
        db,
      );
      expect(result.items[0]!.name).toBe("Alice");
      expect(result.items[1]!.name).toBe("Zelda");
    });

    it("sorts by chat count descending", () => {
      const data = makeCharacterData();
      createCharacter({ id: "char-1", userId, name: "Few", data }, db);
      createCharacter({ id: "char-2", userId, name: "Many", data }, db);
      const now = new Date();
      db.insert(chats).values({ id: "chat-1", userId, characterId: "char-2", title: "C", createdAt: now, updatedAt: now }).run();
      db.insert(chats).values({ id: "chat-2", userId, characterId: "char-2", title: "C2", createdAt: now, updatedAt: now }).run();
      const result = searchCharacterCards(
        userId,
        { sort: "chats-desc", offset: 0, limit: 10 },
        db,
      );
      expect(result.items[0]!.name).toBe("Many");
      expect(result.items[0]!.chatCount).toBe(2);
    });

    it("paginates with offset and limit", () => {
      const data = makeCharacterData();
      createCharacter({ id: "char-1", userId, name: "A", data }, db);
      createCharacter({ id: "char-2", userId, name: "B", data }, db);
      createCharacter({ id: "char-3", userId, name: "C", data }, db);
      const result = searchCharacterCards(userId, { offset: 1, limit: 1 }, db);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(3);
    });

    it("returns correct total count for filtered result", () => {
      createCharacter(
        { id: "char-1", userId, name: "Alice", data: makeCharacterData() },
        db,
      );
      createCharacter(
        { id: "char-2", userId, name: "Bob", data: makeCharacterData() },
        db,
      );
      const result = searchCharacterCards(userId, { q: "Alice", offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("scopes results to the calling user", () => {
      const otherId = seedSecondUser(db);
      createCharacter(
        { id: "char-1", userId: otherId, name: "theirs", data: makeCharacterData() },
        db,
      );
      const result = searchCharacterCards(userId, { offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("reads tags from denormalized column (not data JSON)", () => {
      const data = makeCharacterData({ tags: ["denorm"] });
      createCharacter({ id: "char-1", userId, name: "X", data }, db);
      const result = searchCharacterCards(userId, { tags: ["denorm"], offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(1);
    });

    it("escapes LIKE wildcards in search query", () => {
      const data = makeCharacterData({ creator: "100% real" });
      createCharacter({ id: "char-1", userId, name: "X", data }, db);
      const result = searchCharacterCards(userId, { q: "100%", offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(1);
    });
  });

  describe("characterTagCounts", () => {
    it("returns empty array when user has no characters", () => {
      expect(characterTagCounts(userId, db)).toEqual([]);
    });

    it("counts tags across all user's characters", () => {
      createCharacter(
        { id: "char-1", userId, name: "A", data: makeCharacterData({ tags: ["fantasy", "elf"] }) },
        db,
      );
      createCharacter(
        { id: "char-2", userId, name: "B", data: makeCharacterData({ tags: ["fantasy", "gm"] }) },
        db,
      );
      const counts = characterTagCounts(userId, db);
      const fantasy = counts.find((c) => c.name === "fantasy");
      expect(fantasy?.count).toBe(2);
      const elf = counts.find((c) => c.name === "elf");
      expect(elf?.count).toBe(1);
    });

    it("sorts tags alphabetically", () => {
      createCharacter(
        { id: "char-1", userId, name: "X", data: makeCharacterData({ tags: ["zebra", "alpha"] }) },
        db,
      );
      const counts = characterTagCounts(userId, db);
      expect(counts[0]!.name).toBe("alpha");
      expect(counts[1]!.name).toBe("zebra");
    });

    it("scopes to the calling user", () => {
      const otherId = seedSecondUser(db);
      createCharacter(
        { id: "char-1", userId: otherId, name: "X", data: makeCharacterData({ tags: ["theirs"] }) },
        db,
      );
      expect(characterTagCounts(userId, db)).toEqual([]);
    });
  });
});
