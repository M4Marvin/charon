import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRevision,
  getRevision,
  listRevisions,
  restoreCharacterRevision,
  updateCharacterWithRevision,
} from "@/db/repositories/character-revisions";
import { createCharacter, deleteCharacter, getCharacter } from "@/db/repositories/characters";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { makeTestDb, type TestDb } from "@/db/__tests__/helpers";

describe("character revisions repository", () => {
  let db: TestDb;
  let ctx: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    ctx = makeTestDb();
    db = ctx.db;
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  function seedCharacter(id = "char-1") {
    createCharacter({ id, name: "Alice", data: makeCharacterData({ name: "Alice" }) }, db);
  }

  describe("createRevision", () => {
    it("assigns monotonically increasing rev per character", () => {
      seedCharacter();
      const r1 = createRevision(
        "char-1",
        { name: "Alice", tagline: null, data: makeCharacterData() },
        db,
      );
      const r2 = createRevision(
        "char-1",
        { name: "Alice v2", tagline: "hi", data: makeCharacterData() },
        db,
      );
      expect(r1.rev).toBe(2);
      expect(r2.rev).toBe(3);
      expect(r2.name).toBe("Alice v2");
      expect(r2.tagline).toBe("hi");
    });

    it("keeps separate rev counters per character", () => {
      seedCharacter("char-1");
      seedCharacter("char-2");
      createRevision("char-1", { name: "A", tagline: null, data: makeCharacterData() }, db);
      const other = createRevision(
        "char-2",
        { name: "B", tagline: null, data: makeCharacterData() },
        db,
      );
      expect(other.rev).toBe(2);
    });

    it("round-trips the data blob including extensions", () => {
      seedCharacter();
      const data = makeCharacterData({ extensions: { talkativeness: 0.7 } });
      const rev = createRevision("char-1", { name: "Alice", tagline: null, data }, db);
      expect(rev.data).toEqual(data);
    });
  });

  describe("listRevisions", () => {
    it("returns summaries newest-first without the data blob", () => {
      seedCharacter();
      createRevision("char-1", { name: "v1", tagline: null, data: makeCharacterData() }, db);
      createRevision("char-1", { name: "v2", tagline: "t", data: makeCharacterData() }, db);
      const list = listRevisions("char-1", db);
      // Plus the rev 1 baseline seeded by createCharacter.
      expect(list.map((r) => r.rev)).toEqual([3, 2, 1]);
      expect(list[1]?.name).toBe("v1");
      expect(list[0]?.tagline).toBe("t");
      expect("data" in (list[0] ?? {})).toBe(false);
    });

    it("returns an empty array when there are no revisions", () => {
      expect(listRevisions("missing", db)).toEqual([]);
    });
  });

  describe("getRevision", () => {
    it("returns the full snapshot for a rev", () => {
      seedCharacter();
      const data = makeCharacterData({ description: "snapshot" });
      createRevision("char-1", { name: "v1", tagline: null, data }, db);
      const rev = getRevision("char-1", 2, db);
      expect(rev.rev).toBe(2);
      expect(rev.data).toEqual(data);
    });

    it("throws when the rev does not exist", () => {
      seedCharacter();
      expect(() => getRevision("char-1", 99, db)).toThrow("Revision not found");
    });
  });

  describe("createCharacter baseline", () => {
    it("seeds revision 1 from the created row", () => {
      const data = makeCharacterData({ name: "Alice" });
      createCharacter({ id: "char-1", name: "Alice", data, tagline: "hello" }, db);

      const revisions = listRevisions("char-1", db);
      expect(revisions.map((r) => r.rev)).toEqual([1]);
      expect(revisions[0]?.name).toBe("Alice");
      expect(revisions[0]?.tagline).toBe("hello");

      const rev = getRevision("char-1", 1, db);
      expect(rev.data).toEqual(data);
    });
  });

  describe("updateCharacterWithRevision", () => {
    it("updates the character and appends a snapshot of the post-save state", () => {
      seedCharacter();
      const newData = makeCharacterData({ name: "Alice", description: "changed" });
      updateCharacterWithRevision(
        "char-1",
        { name: "Alice", data: newData, tagline: "new tag" },
        db,
      );

      const char = getCharacter("char-1", db);
      expect(char.data).toEqual(newData);
      expect(char.tagline).toBe("new tag");

      const revisions = listRevisions("char-1", db);
      expect(revisions).toHaveLength(2);
      expect(revisions[0]?.rev).toBe(2);
      expect(revisions[0]?.tagline).toBe("new tag");
      expect(getRevision("char-1", 2, db).data).toEqual(newData);
    });

    it("snapshots the full row for scalar-only patches (rename)", () => {
      seedCharacter();
      updateCharacterWithRevision("char-1", { name: "Alice Renamed" }, db);

      const char = getCharacter("char-1", db);
      expect(char.name).toBe("Alice Renamed");
      const rev = getRevision("char-1", 2, db);
      expect(rev.name).toBe("Alice Renamed");
      expect(rev.data).toEqual(char.data);
    });

    it("throws when the character does not exist", () => {
      expect(() => updateCharacterWithRevision("missing", { name: "x" }, db)).toThrow(
        "Character not found",
      );
      expect(listRevisions("missing", db)).toEqual([]);
    });
  });

  describe("restoreCharacterRevision", () => {
    it("copies the old snapshot onto the character and appends a new revision", () => {
      seedCharacter();
      const v1 = makeCharacterData({ name: "Alice", description: "original" });
      const v2 = makeCharacterData({ name: "Alice", description: "changed" });
      createRevision("char-1", { name: "Alice", tagline: null, data: v1 }, db);
      updateCharacterWithRevision("char-1", { data: v2 }, db);

      const char = restoreCharacterRevision("char-1", 2, db);

      expect(char.data).toEqual(v1);
      const revisions = listRevisions("char-1", db);
      // rev 1 baseline, v1 as rev 2, save snapshotted v2 as rev 3, restore
      // appended rev 4.
      expect(revisions.map((r) => r.rev)).toEqual([4, 3, 2, 1]);
      // Restoring appends; history is not rewritten.
      expect(getRevision("char-1", 2, db).data).toEqual(v1);
      expect(getRevision("char-1", 3, db).data).toEqual(v2);
      expect(getRevision("char-1", 4, db).data).toEqual(v1);
    });

    it("restores name and tagline from the snapshot", () => {
      seedCharacter();
      createRevision(
        "char-1",
        { name: "Old Name", tagline: "old tag", data: makeCharacterData() },
        db,
      );
      updateCharacterWithRevision("char-1", { name: "New Name", tagline: "new tag" }, db);

      const char = restoreCharacterRevision("char-1", 2, db);
      expect(char.name).toBe("Old Name");
      expect(char.tagline).toBe("old tag");
    });

    it("re-derives the denormalized columns from restored data", () => {
      seedCharacter();
      const v1 = makeCharacterData({ creator: "original-author", tags: ["elf"] });
      createRevision("char-1", { name: "Alice", tagline: null, data: v1 }, db);
      updateCharacterWithRevision(
        "char-1",
        { data: makeCharacterData({ creator: "new-author", tags: ["orc"] }) },
        db,
      );

      const char = restoreCharacterRevision("char-1", 2, db);
      expect(char.creator).toBe("original-author");
      expect(char.tags).toEqual(["elf"]);
    });

    it("throws when the revision does not exist", () => {
      seedCharacter();
      expect(() => restoreCharacterRevision("char-1", 99, db)).toThrow("Revision not found");
    });
  });

  describe("deleteCharacter cascade", () => {
    it("removes revisions with the character (FK enforcement off)", () => {
      seedCharacter();
      createRevision("char-1", { name: "Alice", tagline: null, data: makeCharacterData() }, db);
      ctx.sqlite.pragma("foreign_keys = OFF");

      deleteCharacter("char-1", db);

      expect(listRevisions("char-1", db)).toEqual([]);
      expect(() => getCharacter("char-1", db)).toThrow("Character not found");
    });
  });
});
