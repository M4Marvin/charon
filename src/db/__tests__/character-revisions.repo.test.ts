import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRevision,
  getRevision,
  listRevisions,
  restoreCharacterRevision,
  updateCharacterWithRevision,
  type RevisionSnapshot,
} from "@/db/repositories/character-revisions";
import { createCharacter, deleteCharacter, getCharacter } from "@/db/repositories/characters";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { makeTestDb, type TestDb } from "@/db/__tests__/helpers";
import type { CharacterDataV2 } from "@/lib/st-core/character";

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

  function seedCharacter(id = "char-1", imagePath: string | null = null) {
    createCharacter(
      { id, name: "Alice", data: makeCharacterData({ name: "Alice" }), imagePath },
      db,
    );
  }

  function snap(
    overrides: Partial<RevisionSnapshot> & { name?: string; data?: CharacterDataV2 } = {},
  ): RevisionSnapshot {
    return {
      name: overrides.name ?? "Alice",
      tagline: overrides.tagline ?? null,
      spec: overrides.spec ?? "chara_card_v2",
      specVersion: overrides.specVersion ?? "2.0",
      data: overrides.data ?? makeCharacterData({ name: overrides.name ?? "Alice" }),
    };
  }

  describe("createRevision", () => {
    it("assigns monotonically increasing rev per character", () => {
      seedCharacter();
      const r1 = createRevision("char-1", snap({ name: "Alice" }), db);
      const r2 = createRevision("char-1", snap({ name: "Alice v2", tagline: "hi" }), db);
      expect(r1.rev).toBe(2);
      expect(r2.rev).toBe(3);
      expect(r2.name).toBe("Alice v2");
      expect(r2.tagline).toBe("hi");
    });

    it("keeps separate rev counters per character", () => {
      seedCharacter("char-1");
      seedCharacter("char-2");
      createRevision("char-1", snap({ name: "A" }), db);
      const other = createRevision("char-2", snap({ name: "B" }), db);
      expect(other.rev).toBe(2);
    });

    it("round-trips the data blob including extensions", () => {
      seedCharacter();
      const data = makeCharacterData({ extensions: { talkativeness: 0.7 } });
      const rev = createRevision("char-1", snap({ data }), db);
      expect(rev.data).toEqual(data);
    });

    it("round-trips spec identification", () => {
      seedCharacter();
      const rev = createRevision("char-1", snap({ spec: "chara_card_v3", specVersion: "3.0" }), db);
      expect(rev.spec).toBe("chara_card_v3");
      expect(rev.specVersion).toBe("3.0");
    });
  });

  describe("listRevisions", () => {
    it("returns summaries newest-first without the data blob", () => {
      seedCharacter();
      createRevision("char-1", snap({ name: "v1" }), db);
      createRevision("char-1", snap({ name: "v2", tagline: "t" }), db);
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
      createRevision("char-1", snap({ name: "v1", data }), db);
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
      createCharacter(
        {
          id: "char-1",
          name: "Alice",
          data,
          tagline: "hello",
          spec: "chara_card_v3",
          specVersion: "3.0",
        },
        db,
      );

      const revisions = listRevisions("char-1", db);
      expect(revisions.map((r) => r.rev)).toEqual([1]);
      expect(revisions[0]?.name).toBe("Alice");
      expect(revisions[0]?.tagline).toBe("hello");

      const rev = getRevision("char-1", 1, db);
      expect(rev.data).toEqual(data);
      expect(rev.spec).toBe("chara_card_v3");
      expect(rev.specVersion).toBe("3.0");
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

    it("accepts spec, specVersion, and imagePath patches (card update)", () => {
      seedCharacter();
      updateCharacterWithRevision(
        "char-1",
        {
          spec: "chara_card_v3",
          specVersion: "3.0",
          imagePath: "uploads/avatars/new.png",
        },
        db,
      );

      const char = getCharacter("char-1", db);
      expect(char.spec).toBe("chara_card_v3");
      expect(char.specVersion).toBe("3.0");
      expect(char.imagePath).toBe("uploads/avatars/new.png");
      // The post-save snapshot carries the new spec identification.
      expect(getRevision("char-1", 2, db).spec).toBe("chara_card_v3");
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
      seedCharacter("char-1", "uploads/avatars/old.png");
      const v1 = makeCharacterData({ name: "Alice", description: "original" });
      const v2 = makeCharacterData({ name: "Alice", description: "changed" });
      createRevision("char-1", snap({ data: v1 }), db);
      updateCharacterWithRevision("char-1", { data: v2 }, db);

      const char = restoreCharacterRevision("char-1", 2, db);

      expect(char.data).toEqual(v1);
      // The avatar follows the row: art is not snapshotted, restores keep
      // the current portrait (docs/user/characters.md and ui-spec 6.5.5).
      expect(char.imagePath).toBe("uploads/avatars/old.png");
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
      createRevision("char-1", snap({ name: "Old Name", tagline: "old tag" }), db);
      updateCharacterWithRevision("char-1", { name: "New Name", tagline: "new tag" }, db);

      const char = restoreCharacterRevision("char-1", 2, db);
      expect(char.name).toBe("Old Name");
      expect(char.tagline).toBe("old tag");
    });

    it("restores spec identification, keeping spec coherent with the data", () => {
      seedCharacter();
      // Simulate a V2→V3 card update: baseline (v2) is rev 1, the update
      // flips spec to v3 and appends rev 2.
      updateCharacterWithRevision("char-1", { spec: "chara_card_v3", specVersion: "3.0" }, db);
      expect(getCharacter("char-1", db).spec).toBe("chara_card_v3");

      const char = restoreCharacterRevision("char-1", 1, db);
      expect(char.spec).toBe("chara_card_v2");
      expect(char.specVersion).toBe("2.0");
    });

    it("re-derives the denormalized columns from restored data", () => {
      seedCharacter();
      const v1 = makeCharacterData({ creator: "original-author", tags: ["elf"] });
      createRevision("char-1", snap({ data: v1 }), db);
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

  describe("transaction rollback", () => {
    // RAISE(ABORT) on exactly the row createRevision is about to write
    // (max(rev) + 1), which deterministically fails the revision insert
    // inside the transaction. Pre-inserting a colliding row cannot work:
    // createRevision's max read always outruns it.
    function blockNextRevisionInsert(): void {
      ctx.sqlite.exec(`
        CREATE TRIGGER fail_next_revision
        BEFORE INSERT ON character_revisions
        WHEN NEW.rev = (SELECT COALESCE(MAX(rev), 0) + 1 FROM character_revisions WHERE character_id = NEW.character_id)
        BEGIN SELECT RAISE(ABORT, 'test: revision insert blocked'); END
      `);
    }

    function unblockRevisionInsert(): void {
      ctx.sqlite.exec("DROP TRIGGER IF EXISTS fail_next_revision");
    }

    it("createCharacter rolls the character row back when the baseline revision insert fails", () => {
      blockNextRevisionInsert();
      try {
        expect(() =>
          createCharacter(
            { id: "char-rollback", name: "Bob", data: makeCharacterData({ name: "Bob" }) },
            db,
          ),
        ).toThrow(/revision insert blocked/);
      } finally {
        unblockRevisionInsert();
      }

      expect(() => getCharacter("char-rollback", db)).toThrow("Character not found");
      expect(listRevisions("char-rollback", db)).toEqual([]);
    });

    it("updateCharacterWithRevision rolls the update back when the revision insert fails", () => {
      seedCharacter();
      blockNextRevisionInsert();
      try {
        expect(() => updateCharacterWithRevision("char-1", { name: "New Name" }, db)).toThrow(
          /revision insert blocked/,
        );
      } finally {
        unblockRevisionInsert();
      }

      const char = getCharacter("char-1", db);
      expect(char.name).toBe("Alice");
      const revisions = listRevisions("char-1", db);
      expect(revisions).toHaveLength(1);
      expect(revisions[0].name).toBe("Alice");
    });
  });

  describe("deleteCharacter cascade", () => {
    it("removes revisions with the character (FK enforcement off)", () => {
      seedCharacter();
      createRevision("char-1", snap(), db);
      ctx.sqlite.pragma("foreign_keys = OFF");

      deleteCharacter("char-1", db);

      expect(listRevisions("char-1", db)).toEqual([]);
      expect(() => getCharacter("char-1", db)).toThrow("Character not found");
    });
  });
});
