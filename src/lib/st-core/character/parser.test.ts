import { describe, expect, it } from "vitest";
import extract from "png-chunks-extract";
import PNGtext from "png-chunk-text";
import { crc32 } from "crc";
import {
  getCharacterCardSpec,
  parseCharacterCard,
  readCharacterCard,
  writeCharacterCard,
  type CharacterCardSpec,
} from "@/lib/st-core/character";

/**
 * Build a minimal PNG with arbitrary tEXt chunks + IEND. Includes a
 * minimal IHDR (1x1, 8-bit RGBA) because `png-chunks-extract` validates
 * the IHDR is present. There is no real IDAT; the parser only reads
 * tEXt chunks, so this is sufficient for testing.
 */
function buildPng(textChunks: Array<{ keyword: string; text: string }>): Uint8Array {
  // Minimal 1x1 8-bit RGBA IHDR (13 bytes data).
  const ihdr = new Uint8Array(13);
  ihdr[0] = 0;
  ihdr[1] = 0;
  ihdr[2] = 0;
  ihdr[3] = 1; // width = 1
  ihdr[4] = 0;
  ihdr[5] = 0;
  ihdr[6] = 0;
  ihdr[7] = 1; // height = 1
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type = RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const chunks: Array<{ name: string; data: Uint8Array }> = [
    { name: "IHDR", data: ihdr },
    ...textChunks.map((t) =>
      PNGtext.encode(t.keyword, Buffer.from(t.text, "utf8").toString("base64")),
    ),
    { name: "IEND", data: new Uint8Array(0) },
  ];

  // Re-implement png-encode inline to avoid pulling the server-only module
  // into the test. (Same algorithm as src/lib/st-core/character/png-encode.ts.)
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

const SAMPLE_V2 = JSON.stringify({
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: { name: "V2 Card" },
});

const SAMPLE_V3 = JSON.stringify({
  spec: "chara_card_v3",
  spec_version: "3.0",
  data: { name: "V3 Card" },
});

describe("character parser", () => {
  describe("getCharacterCardSpec", () => {
    it("returns 'v3' when a ccv3 chunk is present", () => {
      const png = buildPng([{ keyword: "ccv3", text: SAMPLE_V3 }]);
      expect(getCharacterCardSpec(png)).toBe<CharacterCardSpec>("v3");
    });

    it("returns 'v2' when only a chara chunk is present", () => {
      const png = buildPng([{ keyword: "chara", text: SAMPLE_V2 }]);
      expect(getCharacterCardSpec(png)).toBe<CharacterCardSpec>("v2");
    });

    it("prefers 'v3' when both chunks are present", () => {
      const png = buildPng([
        { keyword: "chara", text: SAMPLE_V2 },
        { keyword: "ccv3", text: SAMPLE_V3 },
      ]);
      expect(getCharacterCardSpec(png)).toBe<CharacterCardSpec>("v3");
    });

    it("returns null when neither chunk is present", () => {
      const png = buildPng([]);
      expect(getCharacterCardSpec(png)).toBeNull();
    });

    it("matches keywords case-insensitively", () => {
      const png = buildPng([{ keyword: "CCV3", text: SAMPLE_V3 }]);
      expect(getCharacterCardSpec(png)).toBe<CharacterCardSpec>("v3");
    });
  });

  describe("readCharacterCard", () => {
    it("reads a ccv3 chunk's base64-decoded JSON", () => {
      const png = buildPng([{ keyword: "ccv3", text: SAMPLE_V3 }]);
      expect(readCharacterCard(png)).toBe(SAMPLE_V3);
    });

    it("reads a chara chunk's base64-decoded JSON", () => {
      const png = buildPng([{ keyword: "chara", text: SAMPLE_V2 }]);
      expect(readCharacterCard(png)).toBe(SAMPLE_V2);
    });

    it("prefers ccv3 when both are present", () => {
      const png = buildPng([
        { keyword: "chara", text: SAMPLE_V2 },
        { keyword: "ccv3", text: SAMPLE_V3 },
      ]);
      expect(readCharacterCard(png)).toBe(SAMPLE_V3);
    });

    it("throws when no character chunk is present", () => {
      const png = buildPng([]);
      expect(() => readCharacterCard(png)).toThrow("No PNG metadata.");
    });
  });

  describe("parseCharacterCard", () => {
    it("parses a V3 card from the ccv3 chunk", () => {
      const png = buildPng([{ keyword: "ccv3", text: SAMPLE_V3 }]);
      const card = parseCharacterCard(png);
      expect(card).toMatchObject({ spec: "chara_card_v3", spec_version: "3.0" });
      expect((card as { data: { name: string } }).data.name).toBe("V3 Card");
    });

    it("parses a V2 card from the chara chunk", () => {
      const png = buildPng([{ keyword: "chara", text: SAMPLE_V2 }]);
      const card = parseCharacterCard(png);
      expect(card).toMatchObject({ spec: "chara_card_v2", spec_version: "2.0" });
    });
  });

  describe("writeCharacterCard", () => {
    it("emits a chara chunk for V2 data", () => {
      const src = buildPng([{ keyword: "stale", text: "old" }]);
      const out = writeCharacterCard(src, SAMPLE_V2);

      // Find the chara chunk
      const chunks = extract(out);
      const chara = chunks.find(
        (c) => c.name === "tEXt" && PNGtext.decode(c.data).keyword.toLowerCase() === "chara",
      );
      expect(chara).toBeDefined();
      const decoded = Buffer.from(PNGtext.decode(chara!.data).text, "base64").toString("utf8");
      expect(decoded).toBe(SAMPLE_V2);

      // No ccv3 chunk should be present
      const ccv3 = chunks.find(
        (c) => c.name === "tEXt" && PNGtext.decode(c.data).keyword.toLowerCase() === "ccv3",
      );
      expect(ccv3).toBeUndefined();
    });

    it("emits both chara and ccv3 chunks for V3 data", () => {
      const src = buildPng([]);
      const out = writeCharacterCard(src, SAMPLE_V3);

      const chunks = extract(out);
      const chara = chunks.find(
        (c) => c.name === "tEXt" && PNGtext.decode(c.data).keyword.toLowerCase() === "chara",
      );
      const ccv3 = chunks.find(
        (c) => c.name === "tEXt" && PNGtext.decode(c.data).keyword.toLowerCase() === "ccv3",
      );
      expect(chara).toBeDefined();
      expect(ccv3).toBeDefined();

      const charaDecoded = Buffer.from(PNGtext.decode(chara!.data).text, "base64").toString("utf8");
      const ccv3Decoded = Buffer.from(PNGtext.decode(ccv3!.data).text, "base64").toString("utf8");
      // ccv3 is the original V3 JSON
      expect(ccv3Decoded).toBe(SAMPLE_V3);
      // chara is a backfilled V2 with a creator_notes warning
      const charaJson = JSON.parse(charaDecoded) as {
        spec: string;
        data: { creator_notes: string };
      };
      expect(charaJson.spec).toBe("chara_card_v2");
      expect(charaJson.data.creator_notes).toContain("Character Card V3");
    });

    it("preserves the V3 creator_notes in the V2 backfill", () => {
      const v3 = JSON.stringify({
        spec: "chara_card_v3",
        spec_version: "3.0",
        data: { name: "X", creator_notes: "Important note" },
      });
      const src = buildPng([]);
      const out = writeCharacterCard(src, v3);
      const chunks = extract(out);
      const chara = chunks.find(
        (c) => c.name === "tEXt" && PNGtext.decode(c.data).keyword.toLowerCase() === "chara",
      );
      const charaJson = JSON.parse(
        Buffer.from(PNGtext.decode(chara!.data).text, "base64").toString("utf8"),
      ) as { data: { creator_notes: string } };
      expect(charaJson.data.creator_notes).toContain("Important note");
      expect(charaJson.data.creator_notes).toContain("Character Card V3");
    });

    it("strips existing chara/ccv3 chunks before writing", () => {
      const stale = JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", data: {} });
      const src = buildPng([
        { keyword: "chara", text: stale },
        { keyword: "ccv3", text: stale },
      ]);
      const out = writeCharacterCard(src, SAMPLE_V2);
      const chunks = extract(out);
      const charaChunks = chunks.filter(
        (c) => c.name === "tEXt" && PNGtext.decode(c.data).keyword.toLowerCase() === "chara",
      );
      const ccv3Chunks = chunks.filter(
        (c) => c.name === "tEXt" && PNGtext.decode(c.data).keyword.toLowerCase() === "ccv3",
      );
      expect(charaChunks).toHaveLength(1);
      expect(ccv3Chunks).toHaveLength(0);
    });

    it("falls back to V2 behavior when JSON is malformed", () => {
      const src = buildPng([]);
      const out = writeCharacterCard(src, "not json");
      const chunks = extract(out);
      const chara = chunks.find(
        (c) => c.name === "tEXt" && PNGtext.decode(c.data).keyword.toLowerCase() === "chara",
      );
      expect(chara).toBeDefined();
    });

    it("round-trips V3 through write → read", () => {
      const src = buildPng([]);
      const out = writeCharacterCard(src, SAMPLE_V3);
      expect(getCharacterCardSpec(out)).toBe<CharacterCardSpec>("v3");
      const card = parseCharacterCard(out) as { spec: string; data: { name: string } };
      expect(card.spec).toBe("chara_card_v3");
      expect(card.data.name).toBe("V3 Card");
    });
  });
});
