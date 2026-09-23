import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deflateSync } from "node:zlib";
import PNGtext from "png-chunk-text";
import { crc32 } from "crc";
import {
  importCharacterCard,
  parseAndValidateCard,
  previewCharacterCard,
} from "@/server/services/character/importer";
import { createCharacter, getCharacter } from "@/db/repositories/characters";
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

  it("returns duplicateOf when name matches an existing character", async () => {
    createCharacter(
      {
        id: "char-1",
        name: "Zephyr",
        data: {
          name: "Zephyr",
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
        spec: "chara_card_v2",
        specVersion: "2.0",
      },
      db,
    );

    const b64 = makeCard("Zephyr");
    const result = await previewCharacterCard(b64, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.duplicateOf).not.toBeNull();
      expect(result.data.duplicateOf!.name).toBe("Zephyr");
      expect(result.data.duplicateOf!.id).toBe("char-1");
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
      expect(result.data.duplicateOf).toBeNull();
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

  it("uses the Chub-slug-derived name", async () => {
    const b64 = cardWithData({
      name: "Mom",
      extensions: { chub: { full_path: "Anonymous/emme-freehold-your-pet-mom-656d8b705cfb" } },
    });
    const res = await importCharacterCard(b64, db);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.character.name).toBe("Emme Freehold Your Pet Mom");
    const stored = getCharacter(res.character.id, db);
    expect(stored.name).toBe("Emme Freehold Your Pet Mom");
    expect(stored.data.name).toBe("Mom");
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
