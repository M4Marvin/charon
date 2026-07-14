import extract from "png-chunks-extract";
import PNGtext from "png-chunk-text";

/**
 * Detected spec version of a PNG character card image.
 *  - `"v3"` if a `ccv3` tEXt chunk is present (preferred per V3 spec)
 *  - `"v2"` if only a `chara` tEXt chunk is present
 *  - `null` if neither chunk is present
 */
export type CharacterCardSpec = "v2" | "v3" | null;

/**
 * Find the tEXt chunk matching a keyword (case-insensitive).
 * Returns the index into the chunks array, or -1 if not found.
 */
function findTextChunkIndex(
  chunks: Array<{ name: string; data: Uint8Array }>,
  keyword: string,
): number {
  const target = keyword.toLowerCase();
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk.name !== "tEXt") continue;
    if (PNGtext.decode(chunk.data).keyword.toLowerCase() === target) return i;
  }
  return -1;
}

/**
 * Detect which spec the PNG carries, without decoding the JSON.
 * Prefers `ccv3` (V3) over `chara` (V2) when both are present, per the V3
 * spec recommendation: "if the application detects both `chara` and `ccv3`
 * chunk, the application SHOULD use the `ccv3` chunk."
 */
export function getCharacterCardSpec(image: Uint8Array): CharacterCardSpec {
  const chunks = extract(image);
  if (findTextChunkIndex(chunks, "ccv3") !== -1) return "v3";
  if (findTextChunkIndex(chunks, "chara") !== -1) return "v2";
  return null;
}

/**
 * Read character data from a PNG image buffer.
 * Prefers the V3 `ccv3` tEXt chunk; falls back to the V2 `chara` chunk.
 * @throws If neither `ccv3` nor `chara` is found in the PNG.
 */
export function readCharacterCard(image: Uint8Array): string {
  const chunks = extract(image);
  const idx =
    findTextChunkIndex(chunks, "ccv3") !== -1
      ? findTextChunkIndex(chunks, "ccv3")
      : findTextChunkIndex(chunks, "chara");

  if (idx === -1) {
    throw new Error("No PNG metadata.");
  }

  const decoded = PNGtext.decode(chunks[idx].data);
  const buf = Buffer.from(decoded.text, "base64");
  return buf.toString("utf8");
}

/**
 * Parse a PNG image buffer and return the deserialized character card object.
 */
export function parseCharacterCard<T = Record<string, unknown>>(image: Uint8Array): T {
  const raw = readCharacterCard(image);
  return JSON.parse(raw) as T;
}
