import extract from "png-chunks-extract";
import PNGtext from "png-chunk-text";

/**
 * Read character data from a PNG image buffer.
 * Supports both V2 (`chara`) and V3 (`ccv3`) tEXt chunks.
 * V3 (ccv3) takes precedence over V2 (chara).
 * @throws If no character data is found in the PNG.
 */
export function readCharacterCard(image: Uint8Array): string {
  const chunks = extract(image);
  const textChunks = chunks
    .filter((chunk: { name: string }) => chunk.name === "tEXt")
    .map((chunk: { data: Uint8Array }) => PNGtext.decode(chunk.data));

  if (textChunks.length === 0) {
    throw new Error("No PNG metadata.");
  }

  // Prefer ccv3 (V3) over chara (V2)
  const ccv3Index = textChunks.findIndex(
    (chunk: { keyword: string }) => chunk.keyword.toLowerCase() === "ccv3",
  );
  if (ccv3Index > -1) {
    const buf = Buffer.from(textChunks[ccv3Index].text, "base64");
    return buf.toString("utf8");
  }

  const charaIndex = textChunks.findIndex(
    (chunk: { keyword: string }) => chunk.keyword.toLowerCase() === "chara",
  );
  if (charaIndex > -1) {
    const buf = Buffer.from(textChunks[charaIndex].text, "base64");
    return buf.toString("utf8");
  }

  throw new Error("No PNG metadata.");
}

/**
 * Parse a PNG image buffer and return the deserialized character card object.
 */
export function parseCharacterCard<T = Record<string, unknown>>(image: Uint8Array): T {
  const raw = readCharacterCard(image);
  return JSON.parse(raw) as T;
}
