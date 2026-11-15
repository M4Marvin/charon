import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deflateSync } from "node:zlib";
import PNGtext from "png-chunk-text";
import { crc32 } from "crc";
import {
  importCharacterCard,
  parseAndValidateCard,
  previewCharacterCard,
  updateCharacterCard,
} from "@/server/services/character/importer";
import { createCharacter, getCharacter, listCharacters } from "@/db/repositories/characters";
import { getRevision, listRevisions } from "@/db/repositories/character-revisions";
import { removePrivatePath } from "@/server/uploads";
import {
  createLorebook,
  getLorebook,
  listEntries,
  listLorebooks,
} from "@/db/repositories/lorebooks";
import { DEFAULT_LORE_CONFIG } from "@/lib/st-core/lorebook";
import { makeTestDb, type TestDb } from "@/db/__tests__/helpers";

vi.mock("@/server/uploads", () => ({
  ensureUploadsDirs: vi.fn(async () => {}),
  diskPathFromStored: (p: string) => `/tmp/charon-test/${p}`,
  storedPathFromDiskComponents: (_s: string, f: string) => `uploads/avatars/${f}`,
  writePrivateFileAtomic: vi.fn(async () => {}),
  removePrivatePath: vi.fn(async () => {}),
  UPLOADS_DISK_ROOT: "data",
}));
const mockInvalidateCache = vi.fn(async (..._args: unknown[]) => {});
vi.mock("@/server/image-optimizer", () => ({
  invalidateStoredImageCache: (path: string) => mockInvalidateCache(path),
}));
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
  writeFile: vi.fn(async () => {}),
  rm: vi.fn(async () => {}),
}));

/**
 * Build a minimal valid PNG with arbitrary tEXt chunks + IEND. It includes
 * one decoded IDAT row so upload-level validation exercises the pixel data as
 * well as the character metadata.
 */
function buildPng(textChunks: Array<{ keyword: string; text: string }>): Uint8Array {
  const ihdr = new Uint8Array(13);
  ihdr[0] = 0;
  ihdr[1] = 0;
  ihdr[2] = 0;
  ihdr[3] = 1;
  ihdr[4] = 0;
  ihdr[5] = 0;
  ihdr[6] = 0;
  ihdr[7] = 1;
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const chunks: Array<{ name: string; data: Uint8Array }> = [
    { name: "IHDR", data: ihdr },
    { name: "IDAT", data: new Uint8Array(deflateSync(Buffer.from([0, 255, 0, 0, 0]))) },
    ...textChunks.map((t) =>
      PNGtext.encode(t.keyword, Buffer.from(t.text, "utf8").toString("base64")),
    ),
    { name: "IEND", data: new Uint8Array(0) },
  ];

  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const uint8 = new Uint8Array(4);
  const int32 = new Int32Array(uint8.buffer);
  const uint32 = new Uint32Array(uint8.buffer);

  let totalSize = 8;
  for (const c of chunks) totalSize += c.data.length + 12;
  const out = new Uint8Array(totalSize);
  for (let i = 0; i < SIG.length; i++) out[i] = SIG[i];
  let idx = 8;
  for (const c of chunks) {
    const nameChars = [
      c.name.charCodeAt(0),
      c.name.charCodeAt(1),
      c.name.charCodeAt(2),
      c.name.charCodeAt(3),
    ];
    uint32[0] = c.data.length;
    out[idx++] = uint8[3];
    out[idx++] = uint8[2];
    out[idx++] = uint8[1];
    out[idx++] = uint8[0];
    for (const ch of nameChars) out[idx++] = ch;
    for (let j = 0; j < c.data.length; j++) out[idx++] = c.data[j];
    const typeBuf = Buffer.from(nameChars);
    const typeCrc = crc32(typeBuf);
    const crc = crc32(Buffer.from(c.data), typeCrc);
    int32[0] = crc;
    out[idx++] = uint8[3];
    out[idx++] = uint8[2];
    out[idx++] = uint8[1];
    out[idx++] = uint8[0];
  }
  return out;
}

function validCardJson(name: string): string {
  return JSON.stringify({
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name,
      description: "A test character",
      personality: "Helpful",
      scenario: "Testing",
      first_mes: "Hello!",
      mes_example: "",
      creator_notes: "Test notes",
      system_prompt: "",
      post_history_instructions: "",
      alternate_greetings: ["Hi!", "Hey!"],
      character_book: {
        entries: [
          { keys: ["test"], content: "World info", enabled: true },
          { keys: ["lore"], content: "More info", enabled: true },
        ],
      },
      tags: ["fantasy", "rpg"],
      creator: "Tester",
      character_version: "1.0",
      extensions: {},
    },
  });
}

function makeCard(name: string): string {
  const png = buildPng([{ keyword: "chara", text: validCardJson(name) }]);
  return Buffer.from(png).toString("base64");
}

/** Minimal valid V2 card data for seeding characters directly. */
function makeEmptyCardData(name: string) {
  return {
    name,
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
    character_version: "",
    extensions: {},
  };
}

describe("parseAndValidateCard", () => {
  it("rejects invalid base64", () => {
    const result = parseAndValidateCard("invalid!@@");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid_png");
    }
  });

  it("rejects a PNG without character data", () => {
    const png = buildPng([]);
    const b64 = Buffer.from(png).toString("base64");
    const result = parseAndValidateCard(b64);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid_png");
    }
  });

  it("parses a valid V2 character card", () => {
    const b64 = makeCard("Alaric");
    const result = parseAndValidateCard(b64);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed.cardData.name).toBe("Alaric");
      expect(result.parsed.spec).toBe("chara_card_v2");
      expect(result.parsed.specVersion).toBe("2.0");
      expect(result.parsed.cardData.tags).toEqual(["fantasy", "rpg"]);
    }
  });

  it("rejects a card with no character name", () => {
    const result = parseAndValidateCard(makeCard(""));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
      if (result.error.kind === "validation") {
        expect(result.error.errors).toEqual([
          { field: "name", message: expect.stringMatching(/no character name/) },
        ]);
      }
    }
  });
});

describe("previewCharacterCard", () => {
  let db: TestDb;
  let ctx: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    ctx = makeTestDb();
    db = ctx.db;
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("returns preview with warnings and counts", async () => {
    const b64 = makeCard("Zephyr");
    const result = await previewCharacterCard(b64, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.preview.name).toBe("Zephyr");
      expect(result.data.preview.creator).toBe("Tester");
      expect(result.data.preview.descriptionExcerpt).toBe("A test character");
      expect(result.data.preview.tags).toEqual(["fantasy", "rpg"]);
      expect(result.data.preview.greetingCount).toBe(2);
      expect(result.data.preview.lorebookEntryCount).toBe(2);
      expect(result.data.preview.spec).toBe("chara_card_v2");
    }
  });

  it("returns duplicates when name matches existing characters, newest first", async () => {
    createCharacter(
      {
        id: "char-1",
        name: "Zephyr",
        data: makeEmptyCardData("Zephyr"),
        spec: "chara_card_v2",
        specVersion: "2.0",
      },
      db,
    );
    await new Promise((r) => setTimeout(r, 10));
    createCharacter(
      {
        id: "char-2",
        name: "zephyr",
        data: makeEmptyCardData("zephyr"),
        spec: "chara_card_v2",
        specVersion: "2.0",
      },
      db,
    );

    const b64 = makeCard("Zephyr");
    const result = await previewCharacterCard(b64, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Case-insensitive match, ordered most recently updated first.
      expect(result.data.duplicates.map((d) => d.id)).toEqual(["char-2", "char-1"]);
    }
  });

  it("returns no duplicates when the name is new", async () => {
    const b64 = makeCard("Brand New");
    const result = await previewCharacterCard(b64, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.duplicates).toEqual([]);
    }
  });

  it("matches NFD-named cards against NFC-named characters", async () => {
    createCharacter(
      {
        id: "char-nfc",
        name: "Café Wizard",
        data: makeEmptyCardData("Café Wizard"),
        spec: "chara_card_v2",
        specVersion: "2.0",
      },
      db,
    );

    // NFD (decomposed) form of the same name, as some card exporters emit.
    const nfdName = "Cafe\u0301 Wizard";
    expect(nfdName.normalize("NFC")).toBe("Café Wizard");
    const result = await previewCharacterCard(makeCard(nfdName), db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.duplicates.map((d) => d.id)).toEqual(["char-nfc"]);
    }
  });

  it("matches names that differ only in surrounding whitespace", async () => {
    createCharacter(
      {
        id: "char-pad",
        name: " Ada ",
        data: makeEmptyCardData(" Ada "),
        spec: "chara_card_v2",
        specVersion: "2.0",
      },
      db,
    );

    const result = await previewCharacterCard(makeCard("Ada"), db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.duplicates.map((d) => d.id)).toEqual(["char-pad"]);
    }
  });

  it("handles cards with minimal data", async () => {
    const minimalCard = JSON.stringify({
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "Echo",
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
        character_version: "",
        extensions: {},
      },
    });
    const png = buildPng([{ keyword: "chara", text: minimalCard }]);
    const b64 = Buffer.from(png).toString("base64");
    const result = await previewCharacterCard(b64, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.preview.name).toBe("Echo");
      expect(result.data.preview.greetingCount).toBe(0);
      expect(result.data.preview.lorebookEntryCount).toBe(0);
      expect(result.data.duplicates).toEqual([]);
    }
  });
});

function cardWithData(data: Record<string, unknown>): string {
  const png = buildPng([
    {
      keyword: "chara",
      text: JSON.stringify({
        spec: "chara_card_v2",
        spec_version: "2.0",
        data: {
          name: "Unnamed",
          description: "A test character",
          personality: "Helpful",
          scenario: "Testing",
          first_mes: "Hello!",
          mes_example: "",
          creator_notes: "Test notes",
          system_prompt: "",
          post_history_instructions: "",
          alternate_greetings: [],
          tags: [],
          creator: "Tester",
          character_version: "1.0",
          extensions: {},
          ...data,
        },
      }),
    },
  ]);
  return Buffer.from(png).toString("base64");
}

describe("importCharacterCard with embedded lorebook", () => {
  let db: TestDb;
  let ctx: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    ctx = makeTestDb();
    db = ctx.db;
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("rejects a nameless card before writing the avatar or row", async () => {
    const res = await importCharacterCard(makeCard(""), db);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("validation");
    }
    expect(listCharacters(db)).toHaveLength(0);
  });

  it("creates a standalone disabled lorebook from the embedded book", async () => {
    const res = await importCharacterCard(makeCard("Zephyr"), db);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.lorebook).not.toBeNull();
    expect(res.lorebook!.name).toBe("Zephyr [embedded]");
    expect(res.lorebook!.entriesInserted).toBe(2);
    const lb = getLorebook(res.lorebook!.id, db);
    expect(lb.name).toBe("Zephyr [embedded]");
    const imported = listLorebooks(db).find((b) => b.id === res.lorebook!.id);
    expect(imported?.enabled).toBe(false);
  });

  it("seeds revision 1 from the imported card", async () => {
    const res = await importCharacterCard(makeCard("Zephyr"), db);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const revisions = listRevisions(res.character.id, db);
    expect(revisions.map((r) => r.rev)).toEqual([1]);
    expect(revisions[0]?.name).toBe("Zephyr");
    expect(getRevision(res.character.id, 1, db).data.name).toBe("Zephyr");
  });

  it("preserves a Yume-style book with empty keys", async () => {
    const b64 = cardWithData({
      character_book: {
        entries: [
          { keys: [], content: "Lore A" },
          { keys: [], content: "Lore B" },
        ],
      },
    });
    const res = await importCharacterCard(b64, db);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.lorebook).not.toBeNull();
    expect(res.lorebook!.entriesInserted).toBe(2);
    expect(listEntries(res.lorebook!.id, db)).toHaveLength(2);
  });

  it("skips extraction when a same-named lorebook already exists", async () => {
    createLorebook(
      {
        id: "lb-existing",
        name: "Zephyr [embedded]",
        description: null,
        config: DEFAULT_LORE_CONFIG,
      },
      db,
    );
    const res = await importCharacterCard(makeCard("Zephyr"), db);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.lorebook).toBeNull();
  });

  it("returns no lorebook when the card has no embedded book", async () => {
    const res = await importCharacterCard(cardWithData({}), db);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.lorebook).toBeNull();
  });

  it("uses the source-slug-derived name", async () => {
    const b64 = cardWithData({
      name: "Generic Name",
      extensions: { source: { full_path: "Anonymous/example-character-656d8b705cfb" } },
    });
    const res = await importCharacterCard(b64, db);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.character.name).toBe("Example Character");
    const stored = getCharacter(res.character.id, db);
    expect(stored.name).toBe("Example Character");
    expect(stored.data.name).toBe("Generic Name");
  });

  it("survives a lorebook insert failure without failing the character import", async () => {
    const b64 = cardWithData({
      character_book: {
        entries: [
          { id: 1, keys: ["a"], content: "A" },
          { id: 1, keys: ["b"], content: "B" },
        ],
      },
    });
    const res = await importCharacterCard(b64, db);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.lorebook).not.toBeNull();
    expect(res.lorebook!.entriesInserted).toBe(1);
    expect(res.lorebook!.entriesSkipped).toBe(1);
    expect(listEntries(res.lorebook!.id, db)).toHaveLength(1);
  });
});

describe("updateCharacterCard", () => {
  let db: TestDb;
  let ctx: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    ctx = makeTestDb();
    db = ctx.db;
    vi.clearAllMocks();
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  function seedTarget(name = "Old Name"): string {
    createCharacter(
      {
        id: "char-target",
        name,
        data: {
          name,
          description: "original description",
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
          character_version: "",
          extensions: {},
        },
        imagePath: "uploads/avatars/old.png",
        tagline: "keep me",
        spec: "chara_card_v2",
        specVersion: "2.0",
      },
      db,
    );
    return "char-target";
  }

  it("replaces data, name, spec, and avatar; preserves tagline; appends a revision", async () => {
    const targetId = seedTarget();

    const v2Card = JSON.parse(validCardJson("Zephyr")) as Record<string, unknown>;
    const v3Card = JSON.stringify({ ...v2Card, spec: "chara_card_v3", spec_version: "3.0" });
    const b64 = Buffer.from(buildPng([{ keyword: "ccv3", text: v3Card }])).toString("base64");

    const res = await updateCharacterCard(b64, targetId, db);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.character.id).toBe(targetId);
    expect(res.character.name).toBe("Zephyr");

    const stored = getCharacter(targetId, db);
    expect(stored.name).toBe("Zephyr");
    expect(stored.spec).toBe("chara_card_v3");
    expect(stored.specVersion).toBe("3.0");
    expect(stored.tagline).toBe("keep me");
    expect(stored.imagePath).toBe(res.character.imagePath);
    expect(stored.imagePath).not.toBe("uploads/avatars/old.png");
    expect(stored.data.description).toBe("A test character");

    // Baseline revision 1 + the update snapshot as revision 2.
    const revisions = listRevisions(targetId, db);
    expect(revisions.map((r) => r.rev)).toEqual([2, 1]);
    expect(getRevision(targetId, 2, db).data.description).toBe("A test character");
    expect(getRevision(targetId, 1, db).data.description).toBe("original description");
  });

  it("removes the old avatar file and invalidates its image cache", async () => {
    const targetId = seedTarget();
    const res = await updateCharacterCard(makeCard("Zephyr"), targetId, db);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(mockInvalidateCache).toHaveBeenCalledWith("uploads/avatars/old.png");
    const removedPaths = (removePrivatePath as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    );
    expect(removedPaths).toContain("/tmp/charon-test/uploads/avatars/old.png");
    // The cleanup only ever deletes paths the live row no longer references.
    expect(removedPaths).not.toContain(res.character.imagePath);
  });

  it("rejects a card with no character name instead of committing an empty one", async () => {
    const targetId = seedTarget();
    const res = await updateCharacterCard(makeCard(""), targetId, db);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("validation");
    }
    // The target is untouched.
    expect(getCharacter(targetId, db).name).toBe("Old Name");
    expect(listRevisions(targetId, db)).toHaveLength(1);
  });

  it("fails with target_missing when the character does not exist", async () => {
    const res = await updateCharacterCard(makeCard("Zephyr"), "char-gone", db);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe("target_missing");
    expect(mockInvalidateCache).not.toHaveBeenCalled();
  });

  it("rethrows real database errors instead of mislabeling them target_missing", async () => {
    seedTarget();
    ctx.sqlite.close();
    await expect(updateCharacterCard(makeCard("Zephyr"), "char-target", db)).rejects.toThrow();
  });

  it("extracts the embedded lorebook like a fresh import does", async () => {
    const targetId = seedTarget();
    const res = await updateCharacterCard(makeCard("Zephyr"), targetId, db);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.lorebook).not.toBeNull();
    expect(res.lorebook!.name).toBe("Zephyr [embedded]");
    expect(listEntries(res.lorebook!.id, db)).toHaveLength(2);
  });

  it("skips lorebook extraction when a same-named lorebook already exists", async () => {
    const targetId = seedTarget();
    // The original import of "Zephyr" would have created this lorebook.
    createLorebook(
      {
        id: "lb-existing",
        name: "Zephyr [embedded]",
        description: null,
        config: DEFAULT_LORE_CONFIG,
      },
      db,
    );

    const res = await updateCharacterCard(makeCard("Zephyr"), targetId, db);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.lorebook).toBeNull();
    expect(listLorebooks(db)).toHaveLength(1);
  });

  it("skips old-avatar cleanup when the character had no image", async () => {
    createCharacter(
      {
        id: "char-target",
        name: "Old Name",
        data: {
          name: "Old Name",
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
          character_version: "",
          extensions: {},
        },
        imagePath: null,
        spec: "chara_card_v2",
        specVersion: "2.0",
      },
      db,
    );
    vi.clearAllMocks();

    const res = await updateCharacterCard(makeCard("Zephyr"), "char-target", db);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const removedPaths = (removePrivatePath as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    );
    expect(removedPaths).not.toContain("/tmp/charon-test/uploads/avatars/old.png");
    expect(mockInvalidateCache).not.toHaveBeenCalled();
  });
});
