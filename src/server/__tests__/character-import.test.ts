import { afterEach, beforeEach, describe, expect, it } from "vitest";
import PNGtext from "png-chunk-text";
import { crc32 } from "crc";
import { parseAndValidateCard, previewCharacterCard } from "@/server/services/character/importer";
import { createCharacter } from "@/db/repositories/characters";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";

/**
 * Build a minimal PNG with arbitrary tEXt chunks + IEND. Same approach as
 * the st-core parser test: IHDR + tEXt chunks + IEND, using the `crc`
 * package for correct CRC values. No IDAT needed — the parser only reads
 * tEXt chunks.
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

  it("returns preview with warnings and counts", () => {
    const b64 = makeCard("Zephyr");
    const result = previewCharacterCard(b64, userId, db);
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

  it("returns duplicateOf when name matches an existing character", () => {
    createCharacter(
      {
        id: "char-1",
        userId,
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
    const result = previewCharacterCard(b64, userId, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.duplicateOf).not.toBeNull();
      expect(result.data.duplicateOf!.name).toBe("Zephyr");
      expect(result.data.duplicateOf!.id).toBe("char-1");
    }
  });

  it("handles cards with minimal data", () => {
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
    const result = previewCharacterCard(b64, userId, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.preview.name).toBe("Echo");
      expect(result.data.preview.greetingCount).toBe(0);
      expect(result.data.preview.lorebookEntryCount).toBe(0);
      expect(result.data.duplicateOf).toBeNull();
    }
  });
});
