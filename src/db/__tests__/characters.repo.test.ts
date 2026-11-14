import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createCharacter,
  deleteCharacter,
  getCharacter,
  getCharacterDetail,
  listCharacterNameSummaries,
  listCharacters,
  searchCharacterCards,
  characterTagCounts,
  derivedColumns,
  updateCharacter,
} from "@/db/repositories/characters";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { makeTestDb, type TestDb } from "@/db/__tests__/helpers";
import {
  createChat as repoCreateChat,
  insertMessage as repoInsertMessage,
  listChatsByCharacter,
  listMessages,
} from "@/db/repositories/chats";
import { chats } from "@/db/schema";
import type { CharacterDataV2 } from "@/lib/st-core/character";

describe("characters repository", () => {
  let db: TestDb;

  let ctx: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    ctx = makeTestDb();
    db = ctx.db;
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  describe("createCharacter", () => {
    it("inserts a row with all fields and returns it", () => {
      const data = makeCharacterData({ name: "Alice" });
      const row = createCharacter({ id: "char-1", name: "Alice", data }, db);

      expect(row.id).toBe("char-1");
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
      const fetched = getCharacter("char-v3", db);
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
        { id: "char-stash", name: "V3", data, spec: "chara_card_v3", specVersion: "3.0" },
        db,
      );
      const fetched = getCharacter("char-stash", db);
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
      createCharacter({ id: "char-1", name: "X", data }, db);
      const fetched = getCharacter("char-1", db);
      expect(fetched.data).toEqual(data);
    });

    it("stores imagePath when provided", () => {
      const row = createCharacter(
        {
          id: "char-1",
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
      createCharacter({ id: "char-1", name: "A", data: makeCharacterData() }, db);
    });

    it("returns the character by id", () => {
      const row = getCharacter("char-1", db);
      expect(row.id).toBe("char-1");
    });

    it("throws when id does not exist", () => {
      expect(() => getCharacter("missing", db)).toThrow("Character not found");
    });
  });

  describe("listCharacters", () => {
    it("returns an empty array when there are no characters", () => {
      expect(listCharacters(db)).toEqual([]);
    });

    it("returns all characters", () => {
      createCharacter({ id: "char-1", name: "A", data: makeCharacterData() }, db);
      createCharacter({ id: "char-2", name: "B", data: makeCharacterData() }, db);
      const all = listCharacters(db);
      expect(all.map((c) => c.id).sort()).toEqual(["char-1", "char-2"]);
    });
  });

  describe("updateCharacter", () => {
    beforeEach(() => {
      createCharacter(
        {
          id: "char-1",
          name: "Old",
          data: makeCharacterData({ name: "Old" }),
        },
        db,
      );
    });

    it("applies a partial patch and bumps updatedAt", async () => {
      const before = getCharacter("char-1", db);
      await new Promise((r) => setTimeout(r, 5));
      const updated = updateCharacter("char-1", { name: "New" }, db);
      expect(updated.name).toBe("New");
      expect(updated.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
      expect(updated.createdAt.getTime()).toBe(before.createdAt.getTime());
    });

    it("replaces the data column with new JSON", () => {
      const newData = makeCharacterData({
        description: "updated",
        alternate_greetings: ["yo"],
      });
      const updated = updateCharacter("char-1", { data: newData }, db);
      expect(updated.data).toEqual(newData);
    });

    it("throws when character does not exist", () => {
      expect(() => updateCharacter("missing", { name: "x" }, db)).toThrow("Character not found");
    });
  });

  describe("deleteCharacter", () => {
    beforeEach(() => {
      createCharacter({ id: "char-1", name: "X", data: makeCharacterData() }, db);
    });

    it("removes the row", () => {
      deleteCharacter("char-1", db);
      expect(() => getCharacter("char-1", db)).toThrow("Character not found");
    });

    it("throws when character does not exist", () => {
      expect(() => deleteCharacter("missing", db)).toThrow("Character not found");
    });

    it("deletes the character's chats and messages explicitly with FK enforcement off", () => {
      // dev.db runtime has FK enforcement off (src/db/index.ts), so deletions must cascade by hand.
      ctx.sqlite.pragma("foreign_keys = OFF");
      createCharacter({ id: "char-2", name: "Y", data: makeCharacterData() }, db);
      repoCreateChat({ id: "chat-a", characterId: "char-2", title: "A" }, db);
      repoCreateChat({ id: "chat-b", characterId: "char-2", title: "B" }, db);
      for (const localId of [1, 2, 3]) {
        repoInsertMessage(
          "chat-a",
          {
            chatId: "chat-a",
            localId,
            parentLocalId: null,
            children: [],
            selectedChildLocalId: null,
            role: "assistant",
            content: `a-${localId}`,
            extra: null,
          },
          db,
        );
      }
      for (const localId of [1, 2]) {
        repoInsertMessage(
          "chat-b",
          {
            chatId: "chat-b",
            localId,
            parentLocalId: null,
            children: [],
            selectedChildLocalId: null,
            role: "user",
            content: `b-${localId}`,
            extra: null,
          },
          db,
        );
      }

      deleteCharacter("char-2", db);

      expect(listChatsByCharacter("char-2", db)).toEqual([]);
      expect(() => listMessages("chat-a", db)).toThrow("Chat not found");
      expect(() => listMessages("chat-b", db)).toThrow("Chat not found");
      expect(() => getCharacter("char-2", db)).toThrow("Character not found");
    });
  });

  describe("getCharacterDetail messageCount", () => {
    it("counts all chat messages across the character's chats (all roles)", () => {
      createCharacter({ id: "char-1", name: "X", data: makeCharacterData() }, db);
      repoCreateChat({ id: "chat-a", characterId: "char-1", title: "A" }, db);
      repoCreateChat({ id: "chat-b", characterId: "char-1", title: "B" }, db);

      const messages = [
        { chatId: "chat-a", localId: 1, role: "user" },
        { chatId: "chat-a", localId: 2, role: "assistant" },
        { chatId: "chat-a", localId: 3, role: "assistant" },
        { chatId: "chat-b", localId: 1, role: "user" },
        { chatId: "chat-b", localId: 2, role: "system" },
      ] as const;
      for (const m of messages) {
        repoInsertMessage(
          m.chatId,
          {
            chatId: m.chatId,
            localId: m.localId,
            parentLocalId: null,
            children: [],
            selectedChildLocalId: null,
            role: m.role,
            content: `${m.chatId}-${m.localId}`,
            extra: null,
          },
          db,
        );
      }

      const detail = getCharacterDetail("char-1", db);
      expect(detail.chatCount).toBe(2);
      expect(detail.userMessageCount).toBe(2);
      expect(detail.messageCount).toBe(5);
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
      const row = createCharacter({ id: "char-1", name: "Test", data }, db);
      expect(row.creator).toBe("author");
      expect(row.creatorNotes).toBe("notes");
      expect(row.tags).toEqual(["fantasy"]);
    });
  });

  describe("updateCharacter with derivedColumns", () => {
    it("re-derives columns when data is present in patch", () => {
      const data = makeCharacterData({ creator: "old" });
      createCharacter({ id: "char-1", name: "Test", data }, db);

      const newData = makeCharacterData({ creator: "new", tags: ["elf"] });
      updateCharacter("char-1", { data: newData, name: newData.name }, db);

      const updated = getCharacter("char-1", db);
      expect(updated.creator).toBe("new");
      expect(updated.tags).toEqual(["elf"]);
    });

    it("does not touch columns when data is absent from patch", () => {
      const data = makeCharacterData({ creator: "original" });
      createCharacter({ id: "char-1", name: "OldName", data }, db);
      const before = getCharacter("char-1", db);

      updateCharacter("char-1", { name: "NewName" }, db);

      const after = getCharacter("char-1", db);
      expect(after.name).toBe("NewName");
      expect(after.creator).toBe(before.creator);
    });
  });

  describe("listCharacterNameSummaries", () => {
    it("returns scalar rows without the card data blob", () => {
      createCharacter({ id: "char-1", name: "A", data: makeCharacterData() }, db);
      createCharacter({ id: "char-2", name: "B", data: makeCharacterData() }, db);

      const summaries = listCharacterNameSummaries(db);
      expect(summaries.map((s) => s.name).sort()).toEqual(["A", "B"]);
      expect(summaries[0]?.updatedAt).toBeInstanceOf(Date);
      expect("data" in (summaries[0] ?? {})).toBe(false);
    });
  });

  describe("searchCharacterCards", () => {
    it("returns empty array when there are no characters", () => {
      const result = searchCharacterCards({ offset: 0, limit: 10 }, db);
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("matches name with case-insensitive LIKE", () => {
      const data = makeCharacterData({ name: "Elara Vance" });
      createCharacter({ id: "char-1", name: "Elara Vance", data }, db);
      const result = searchCharacterCards({ q: "elara", offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.name).toBe("Elara Vance");
    });

    it("matches creator", () => {
      const data = makeCharacterData({ creator: "authorName" });
      createCharacter({ id: "char-1", name: "X", data }, db);
      const result = searchCharacterCards({ q: "author", offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(1);
    });

    it("matches creator_notes", () => {
      const data = makeCharacterData({ creator_notes: "special notes here" });
      createCharacter({ id: "char-1", name: "X", data }, db);
      const result = searchCharacterCards({ q: "special", offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(1);
    });

    it("filters by single tag (AND semantics with one tag)", () => {
      const data = makeCharacterData({ tags: ["fantasy"] });
      createCharacter({ id: "char-1", name: "A", data }, db);
      const result = searchCharacterCards({ tags: ["fantasy"], offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(1);
    });

    it("applies AND semantics for multiple tags", () => {
      createCharacter(
        { id: "char-1", name: "A", data: makeCharacterData({ tags: ["fantasy", "elf"] }) },
        db,
      );
      createCharacter(
        { id: "char-2", name: "B", data: makeCharacterData({ tags: ["fantasy"] }) },
        db,
      );
      const result = searchCharacterCards({ tags: ["fantasy", "elf"], offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.name).toBe("A");
    });

    it("sorts by updatedAt descending (default)", async () => {
      const data = makeCharacterData();
      createCharacter({ id: "char-1", name: "Older", data }, db);
      await new Promise((r) => setTimeout(r, 10));
      createCharacter({ id: "char-2", name: "Newer", data }, db);
      const result = searchCharacterCards({ offset: 0, limit: 10 }, db);
      expect(result.items[0]!.name).toBe("Newer");
      expect(result.items[1]!.name).toBe("Older");
    });

    it("sorts by name ascending", () => {
      createCharacter({ id: "char-1", name: "Zelda", data: makeCharacterData() }, db);
      createCharacter({ id: "char-2", name: "Alice", data: makeCharacterData() }, db);
      const result = searchCharacterCards({ sort: "name-asc", offset: 0, limit: 10 }, db);
      expect(result.items[0]!.name).toBe("Alice");
      expect(result.items[1]!.name).toBe("Zelda");
    });

    it("sorts by chat count descending", () => {
      const data = makeCharacterData();
      createCharacter({ id: "char-1", name: "Few", data }, db);
      createCharacter({ id: "char-2", name: "Many", data }, db);
      const now = new Date();
      db.insert(chats)
        .values({
          id: "chat-1",
          characterId: "char-2",
          title: "C",
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(chats)
        .values({
          id: "chat-2",
          characterId: "char-2",
          title: "C2",
          createdAt: now,
          updatedAt: now,
        })
        .run();
      const result = searchCharacterCards({ sort: "chats-desc", offset: 0, limit: 10 }, db);
      expect(result.items[0]!.name).toBe("Many");
      expect(result.items[0]!.chatCount).toBe(2);
    });

    it("paginates with offset and limit", () => {
      const data = makeCharacterData();
      createCharacter({ id: "char-1", name: "A", data }, db);
      createCharacter({ id: "char-2", name: "B", data }, db);
      createCharacter({ id: "char-3", name: "C", data }, db);
      const result = searchCharacterCards({ offset: 1, limit: 1 }, db);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(3);
    });

    it("returns correct total count for filtered result", () => {
      createCharacter({ id: "char-1", name: "Alice", data: makeCharacterData() }, db);
      createCharacter({ id: "char-2", name: "Bob", data: makeCharacterData() }, db);
      const result = searchCharacterCards({ q: "Alice", offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("reads tags from denormalized column (not data JSON)", () => {
      const data = makeCharacterData({ tags: ["denorm"] });
      createCharacter({ id: "char-1", name: "X", data }, db);
      const result = searchCharacterCards({ tags: ["denorm"], offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(1);
    });

    it("escapes LIKE wildcards in search query", () => {
      const data = makeCharacterData({ creator: "100% real" });
      createCharacter({ id: "char-1", name: "X", data }, db);
      const result = searchCharacterCards({ q: "100%", offset: 0, limit: 10 }, db);
      expect(result.items).toHaveLength(1);
    });
  });

  describe("characterTagCounts", () => {
    it("returns empty array when there are no characters", () => {
      expect(characterTagCounts(db)).toEqual([]);
    });

    it("counts tags across all characters", () => {
      createCharacter(
        { id: "char-1", name: "A", data: makeCharacterData({ tags: ["fantasy", "elf"] }) },
        db,
      );
      createCharacter(
        { id: "char-2", name: "B", data: makeCharacterData({ tags: ["fantasy", "gm"] }) },
        db,
      );
      const counts = characterTagCounts(db);
      const fantasy = counts.find((c) => c.name === "fantasy");
      expect(fantasy?.count).toBe(2);
      const elf = counts.find((c) => c.name === "elf");
      expect(elf?.count).toBe(1);
    });

    it("sorts tags alphabetically", () => {
      createCharacter(
        { id: "char-1", name: "X", data: makeCharacterData({ tags: ["zebra", "alpha"] }) },
        db,
      );
      const counts = characterTagCounts(db);
      expect(counts[0]!.name).toBe("alpha");
      expect(counts[1]!.name).toBe("zebra");
    });
  });
});
