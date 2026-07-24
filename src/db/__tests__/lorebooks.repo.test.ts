import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createEntry,
  createLorebook,
  deleteEntry,
  deleteLorebook,
  getEntry,
  getLorebook,
  listEntries,
  listLorebooks,
  nextEntryUid,
  updateEntry,
  updateLorebook,
} from "@/db/repositories/lorebooks";
import { makeLoreEntry, makeLorebookConfig } from "@/db/__tests__/lorebook-data";
import { makeTestDb, seedSecondUser, seedTestUser, type TestDb } from "@/db/__tests__/helpers";

describe("lorebooks repository", () => {
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

  describe("createLorebook", () => {
    it("inserts a row with required fields and returns it", () => {
      const row = createLorebook(
        {
          id: "lb-1",
          userId,
          name: "World Guide",
          config: makeLorebookConfig(),
        },
        db,
      );
      expect(row.id).toBe("lb-1");
      expect(row.userId).toBe(userId);
      expect(row.name).toBe("World Guide");
      expect(row.description).toBeNull();
      expect(row.config).toEqual(makeLorebookConfig());
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);
    });

    it("stores description when provided", () => {
      const row = createLorebook(
        {
          id: "lb-1",
          userId,
          name: "X",
          description: "A description",
          config: makeLorebookConfig(),
        },
        db,
      );
      expect(row.description).toBe("A description");
    });

    it("round-trips config JSON", () => {
      const config = makeLorebookConfig({ depth: 8, scanDepth: 25 });
      createLorebook({ id: "lb-1", userId, name: "X", config }, db);
      const fetched = getLorebook(userId, "lb-1", db);
      expect(fetched.config).toEqual(config);
    });
  });

  describe("getLorebook", () => {
    beforeEach(() => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
    });

    it("returns the lorebook for the owning user", () => {
      const row = getLorebook(userId, "lb-1", db);
      expect(row.id).toBe("lb-1");
    });

    it("throws when id does not exist", () => {
      expect(() => getLorebook(userId, "missing", db)).toThrow("Lorebook not found");
    });

    it("throws when accessed by a different user", () => {
      const otherId = seedSecondUser(db);
      expect(() => getLorebook(otherId, "lb-1", db)).toThrow("Lorebook not found");
    });
  });

  describe("listLorebooks", () => {
    it("returns an empty array when user has no lorebooks", () => {
      expect(listLorebooks(userId, db)).toEqual([]);
    });

    it("returns only the calling user's lorebooks, ordered by name", () => {
      const otherId = seedSecondUser(db);
      createLorebook({ id: "lb-1", userId, name: "Bravo", config: makeLorebookConfig() }, db);
      createLorebook({ id: "lb-2", userId, name: "Alpha", config: makeLorebookConfig() }, db);
      createLorebook(
        { id: "lb-3", userId: otherId, name: "Other", config: makeLorebookConfig() },
        db,
      );
      const mine = listLorebooks(userId, db);
      expect(mine).toHaveLength(2);
      expect(mine.map((l) => l.name)).toEqual(["Alpha", "Bravo"]);
    });

    it("includes entry count via left join", () => {
      createLorebook({ id: "lb-1", userId, name: "Has entries", config: makeLorebookConfig() }, db);
      createLorebook({ id: "lb-2", userId, name: "Empty", config: makeLorebookConfig() }, db);
      const entry = makeLoreEntry({ uid: 1 });
      createEntry(userId, { id: "e-1", lorebookId: "lb-1", uid: 1, data: entry }, db);
      createEntry(
        userId,
        { id: "e-2", lorebookId: "lb-1", uid: 2, data: { ...entry, uid: 2 } },
        db,
      );
      const list = listLorebooks(userId, db);
      const withEntries = list.find((l) => l.id === "lb-1");
      const empty = list.find((l) => l.id === "lb-2");
      expect(withEntries?.entryCount).toBe(2);
      expect(empty?.entryCount).toBe(0);
    });
  });

  describe("updateLorebook", () => {
    beforeEach(() => {
      createLorebook({ id: "lb-1", userId, name: "Old", config: makeLorebookConfig() }, db);
    });

    it("applies a partial patch and bumps updatedAt", async () => {
      const before = getLorebook(userId, "lb-1", db);
      await new Promise((r) => setTimeout(r, 5));
      const updated = updateLorebook(userId, "lb-1", { name: "New" }, db);
      expect(updated.name).toBe("New");
      expect(updated.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    });

    it("updates config with new JSON", () => {
      const newConfig = makeLorebookConfig({ depth: 8 });
      const updated = updateLorebook(userId, "lb-1", { config: newConfig }, db);
      expect(updated.config).toEqual(newConfig);
    });

    it("throws when lorebook does not exist for the user", () => {
      expect(() => updateLorebook(userId, "missing", { name: "x" }, db)).toThrow(
        "Lorebook not found",
      );
    });

    it("throws when patch targets another user's lorebook", () => {
      const otherId = seedSecondUser(db);
      expect(() => updateLorebook(otherId, "lb-1", { name: "x" }, db)).toThrow(
        "Lorebook not found",
      );
    });
  });

  describe("deleteLorebook", () => {
    it("removes the row", () => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      deleteLorebook(userId, "lb-1", db);
      expect(() => getLorebook(userId, "lb-1", db)).toThrow("Lorebook not found");
    });

    it("cascades and removes entries", () => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      const entry = makeLoreEntry({ uid: 1 });
      createEntry(userId, { id: "e-1", lorebookId: "lb-1", uid: 1, data: entry }, db);
      deleteLorebook(userId, "lb-1", db);
      expect(() => listEntries(userId, "lb-1", db)).toThrow("Lorebook not found");
    });

    it("throws when lorebook does not exist", () => {
      expect(() => deleteLorebook(userId, "missing", db)).toThrow("Lorebook not found");
    });

    it("throws when deleting another user's lorebook", () => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      const otherId = seedSecondUser(db);
      expect(() => deleteLorebook(otherId, "lb-1", db)).toThrow("Lorebook not found");
    });
  });

  describe("createEntry", () => {
    beforeEach(() => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
    });

    it("inserts a row with all fields and returns it", () => {
      const data = makeLoreEntry({ uid: 1, comment: "First" });
      const row = createEntry(userId, { id: "e-1", lorebookId: "lb-1", uid: 1, data }, db);
      expect(row.id).toBe("e-1");
      expect(row.lorebookId).toBe("lb-1");
      expect(row.uid).toBe(1);
      expect(row.data).toEqual(data);
    });

    it("throws when lorebook belongs to another user", () => {
      const otherId = seedSecondUser(db);
      const data = makeLoreEntry({ uid: 1 });
      expect(() =>
        createEntry(otherId, { id: "e-1", lorebookId: "lb-1", uid: 1, data }, db),
      ).toThrow("Lorebook not found");
    });
  });

  describe("getEntry", () => {
    beforeEach(() => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      const data = makeLoreEntry({ uid: 1 });
      createEntry(userId, { id: "e-1", lorebookId: "lb-1", uid: 1, data }, db);
    });

    it("returns the entry for the owning user", () => {
      const row = getEntry(userId, "lb-1", "e-1", db);
      expect(row.id).toBe("e-1");
    });

    it("throws when entry does not exist", () => {
      expect(() => getEntry(userId, "lb-1", "missing", db)).toThrow("Lore entry not found");
    });

    it("throws when entry belongs to another lorebook", () => {
      createLorebook({ id: "lb-2", userId, name: "Y", config: makeLorebookConfig() }, db);
      expect(() => getEntry(userId, "lb-2", "e-1", db)).toThrow("Lore entry not found");
    });

    it("throws when accessed by a different user", () => {
      const otherId = seedSecondUser(db);
      expect(() => getEntry(otherId, "lb-1", "e-1", db)).toThrow("Lorebook not found");
    });
  });

  describe("listEntries", () => {
    beforeEach(() => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
    });

    it("returns an empty array when lorebook has no entries", () => {
      expect(listEntries(userId, "lb-1", db)).toEqual([]);
    });

    it("returns entries ordered by uid", () => {
      createEntry(
        userId,
        { id: "e-1", lorebookId: "lb-1", uid: 3, data: makeLoreEntry({ uid: 3 }) },
        db,
      );
      createEntry(
        userId,
        { id: "e-2", lorebookId: "lb-1", uid: 1, data: makeLoreEntry({ uid: 1 }) },
        db,
      );
      createEntry(
        userId,
        { id: "e-3", lorebookId: "lb-1", uid: 2, data: makeLoreEntry({ uid: 2 }) },
        db,
      );
      const list = listEntries(userId, "lb-1", db);
      expect(list.map((e) => e.uid)).toEqual([1, 2, 3]);
    });

    it("throws when lorebook belongs to another user", () => {
      const otherId = seedSecondUser(db);
      expect(() => listEntries(otherId, "lb-1", db)).toThrow("Lorebook not found");
    });
  });

  describe("updateEntry", () => {
    beforeEach(() => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      const data = makeLoreEntry({ uid: 1, comment: "Old" });
      createEntry(userId, { id: "e-1", lorebookId: "lb-1", uid: 1, data }, db);
    });

    it("applies a partial patch", () => {
      const newData = makeLoreEntry({ uid: 1, comment: "New" });
      const updated = updateEntry(userId, "lb-1", "e-1", { data: newData }, db);
      expect(updated.data).toEqual(newData);
    });

    it("changes uid", () => {
      const newData = makeLoreEntry({ uid: 5 });
      const updated = updateEntry(userId, "lb-1", "e-1", { uid: 5, data: newData }, db);
      expect(updated.uid).toBe(5);
    });

    it("throws when entry does not exist", () => {
      expect(() => updateEntry(userId, "lb-1", "missing", { data: makeLoreEntry() }, db)).toThrow(
        "Lore entry not found",
      );
    });

    it("throws when updating entry in another user's lorebook", () => {
      const otherId = seedSecondUser(db);
      expect(() => updateEntry(otherId, "lb-1", "e-1", { data: makeLoreEntry() }, db)).toThrow(
        "Lorebook not found",
      );
    });
  });

  describe("deleteEntry", () => {
    beforeEach(() => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      createEntry(
        userId,
        { id: "e-1", lorebookId: "lb-1", uid: 1, data: makeLoreEntry({ uid: 1 }) },
        db,
      );
    });

    it("removes the row", () => {
      deleteEntry(userId, "lb-1", "e-1", db);
      expect(() => getEntry(userId, "lb-1", "e-1", db)).toThrow("Lore entry not found");
    });

    it("throws when entry does not exist", () => {
      expect(() => deleteEntry(userId, "lb-1", "missing", db)).toThrow("Lore entry not found");
    });

    it("throws when deleting from another user's lorebook", () => {
      const otherId = seedSecondUser(db);
      expect(() => deleteEntry(otherId, "lb-1", "e-1", db)).toThrow("Lorebook not found");
    });
  });

  describe("nextEntryUid", () => {
    beforeEach(() => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
    });

    it("returns 1 when lorebook is empty", () => {
      expect(nextEntryUid(userId, "lb-1", db)).toBe(1);
    });

    it("returns max + 1", () => {
      createEntry(
        userId,
        { id: "e-1", lorebookId: "lb-1", uid: 1, data: makeLoreEntry({ uid: 1 }) },
        db,
      );
      createEntry(
        userId,
        { id: "e-2", lorebookId: "lb-1", uid: 5, data: makeLoreEntry({ uid: 5 }) },
        db,
      );
      expect(nextEntryUid(userId, "lb-1", db)).toBe(6);
    });

    it("throws when lorebook belongs to another user", () => {
      const otherId = seedSecondUser(db);
      expect(() => nextEntryUid(otherId, "lb-1", db)).toThrow("Lorebook not found");
    });
  });
});
