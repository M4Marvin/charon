import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTestDb, seedSecondUser, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import {
  createEntry,
  createLorebook,
  deleteEntry,
  deleteLorebook,
  listEntries,
  listLorebooks,
} from "@/db/repositories/lorebooks";
import { makeLoreEntry, makeLorebookConfig } from "@/db/__tests__/lorebook-data";
import {
  isLorebookEnabled,
  isEntryUserDisabled,
  listEnabledLorebookIds,
  listUserDisabledEntryIds,
  setLorebookEnabled,
  setLoreEntryDisabled,
} from "@/db/repositories/userLorebookSettings";

describe("userLorebookSettings repo", () => {
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

  describe("setLorebookEnabled / isLorebookEnabled", () => {
    it("returns false for a lorebook with no settings row (opt-in default)", () => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      expect(isLorebookEnabled(userId, "lb-1", db)).toBe(false);
    });

    it("enabling sets the row so isLorebookEnabled returns true", () => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      setLorebookEnabled(userId, "lb-1", true, db);
      expect(isLorebookEnabled(userId, "lb-1", db)).toBe(true);
    });

    it("disabling deletes the row", () => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      setLorebookEnabled(userId, "lb-1", true, db);
      setLorebookEnabled(userId, "lb-1", false, db);
      expect(isLorebookEnabled(userId, "lb-1", db)).toBe(false);
    });

    it("enabling twice is a no-op (no error, still enabled)", () => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      setLorebookEnabled(userId, "lb-1", true, db);
      expect(() => setLorebookEnabled(userId, "lb-1", true, db)).not.toThrow();
      expect(isLorebookEnabled(userId, "lb-1", db)).toBe(true);
    });

    it("disabling twice is a no-op", () => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      setLorebookEnabled(userId, "lb-1", false, db);
      expect(() => setLorebookEnabled(userId, "lb-1", false, db)).not.toThrow();
      expect(isLorebookEnabled(userId, "lb-1", db)).toBe(false);
    });
  });

  describe("listEnabledLorebookIds", () => {
    it("returns empty when nothing is enabled", () => {
      createLorebook({ id: "lb-1", userId, name: "A", config: makeLorebookConfig() }, db);
      createLorebook({ id: "lb-2", userId, name: "B", config: makeLorebookConfig() }, db);
      expect(listEnabledLorebookIds(userId, db)).toEqual([]);
    });

    it("returns only the enabled ids for this user", () => {
      const otherId = seedSecondUser(db);
      createLorebook({ id: "lb-1", userId, name: "A", config: makeLorebookConfig() }, db);
      createLorebook({ id: "lb-2", userId, name: "B", config: makeLorebookConfig() }, db);
      createLorebook(
        { id: "lb-3", userId: otherId, name: "Other", config: makeLorebookConfig() },
        db,
      );
      setLorebookEnabled(userId, "lb-2", true, db);
      setLorebookEnabled(otherId, "lb-3", true, db);
      const mine = listEnabledLorebookIds(userId, db);
      expect(mine).toEqual(["lb-2"]);
    });
  });

  describe("setLoreEntryDisabled / isEntryUserDisabled", () => {
    it("returns false for an entry with no overlay row", () => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      createEntry(
        userId,
        { id: "e-1", lorebookId: "lb-1", uid: 1, data: makeLoreEntry({ uid: 1 }) },
        db,
      );
      expect(isEntryUserDisabled(userId, "e-1", db)).toBe(false);
    });

    it("disabling sets the row so isEntryUserDisabled returns true", () => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      createEntry(
        userId,
        { id: "e-1", lorebookId: "lb-1", uid: 1, data: makeLoreEntry({ uid: 1 }) },
        db,
      );
      setLoreEntryDisabled(userId, "e-1", true, db);
      expect(isEntryUserDisabled(userId, "e-1", db)).toBe(true);
    });

    it("re-enabling (disabled=false) deletes the overlay row", () => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      createEntry(
        userId,
        { id: "e-1", lorebookId: "lb-1", uid: 1, data: makeLoreEntry({ uid: 1 }) },
        db,
      );
      setLoreEntryDisabled(userId, "e-1", true, db);
      setLoreEntryDisabled(userId, "e-1", false, db);
      expect(isEntryUserDisabled(userId, "e-1", db)).toBe(false);
    });
  });

  describe("listUserDisabledEntryIds", () => {
    it("returns only entries the current user has disabled", () => {
      const otherId = seedSecondUser(db);
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      createEntry(
        userId,
        { id: "e-1", lorebookId: "lb-1", uid: 1, data: makeLoreEntry({ uid: 1 }) },
        db,
      );
      createEntry(
        userId,
        { id: "e-2", lorebookId: "lb-1", uid: 2, data: makeLoreEntry({ uid: 2 }) },
        db,
      );
      setLoreEntryDisabled(userId, "e-1", true, db);
      setLoreEntryDisabled(otherId, "e-2", true, db);
      expect(listUserDisabledEntryIds(userId, db)).toEqual(["e-1"]);
    });
  });

  describe("listLorebooks join", () => {
    it("reflects enabled state from the overlay", () => {
      createLorebook({ id: "lb-1", userId, name: "A", config: makeLorebookConfig() }, db);
      createLorebook({ id: "lb-2", userId, name: "B", config: makeLorebookConfig() }, db);
      setLorebookEnabled(userId, "lb-1", true, db);
      const list = listLorebooks(userId, db);
      const a = list.find((l) => l.id === "lb-1");
      const b = list.find((l) => l.id === "lb-2");
      expect(a?.enabled).toBe(true);
      expect(b?.enabled).toBe(false);
    });
  });

  describe("listEntries join", () => {
    it("reflects userDisabled state from the overlay", () => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      createEntry(
        userId,
        { id: "e-1", lorebookId: "lb-1", uid: 1, data: makeLoreEntry({ uid: 1 }) },
        db,
      );
      createEntry(
        userId,
        { id: "e-2", lorebookId: "lb-1", uid: 2, data: makeLoreEntry({ uid: 2 }) },
        db,
      );
      setLoreEntryDisabled(userId, "e-1", true, db);
      const list = listEntries(userId, "lb-1", db);
      const e1 = list.find((e) => e.id === "e-1");
      const e2 = list.find((e) => e.id === "e-2");
      expect(e1?.userDisabled).toBe(true);
      expect(e2?.userDisabled).toBe(false);
    });
  });

  describe("cascade on delete", () => {
    it("deleting a lorebook removes its overlay rows (FK enforcement is ON in test db)", () => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      createEntry(
        userId,
        { id: "e-1", lorebookId: "lb-1", uid: 1, data: makeLoreEntry({ uid: 1 }) },
        db,
      );
      setLorebookEnabled(userId, "lb-1", true, db);
      setLoreEntryDisabled(userId, "e-1", true, db);
      expect(isLorebookEnabled(userId, "lb-1", db)).toBe(true);
      expect(isEntryUserDisabled(userId, "e-1", db)).toBe(true);

      deleteLorebook(userId, "lb-1", db);

      expect(isLorebookEnabled(userId, "lb-1", db)).toBe(false);
      expect(isEntryUserDisabled(userId, "e-1", db)).toBe(false);
    });

    it("deleting an entry removes its overlay row", () => {
      createLorebook({ id: "lb-1", userId, name: "X", config: makeLorebookConfig() }, db);
      createEntry(
        userId,
        { id: "e-1", lorebookId: "lb-1", uid: 1, data: makeLoreEntry({ uid: 1 }) },
        db,
      );
      setLoreEntryDisabled(userId, "e-1", true, db);
      expect(isEntryUserDisabled(userId, "e-1", db)).toBe(true);

      deleteEntry(userId, "lb-1", "e-1", db);

      expect(isEntryUserDisabled(userId, "e-1", db)).toBe(false);
    });
  });
});
