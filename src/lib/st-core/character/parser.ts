import extract from "png-chunks-extract";
import PNGtext from "png-chunk-text";

/**
 * Read character data from a PNG image buffer.
 * Only supports the V2 (`chara`) tEXt chunk. V3 (`ccv3`) chunks are ignored.
 * @throws If no `chara` chunk is found in the PNG.
 */
export function readCharacterCard(image: Uint8Array): string {
  const chunks = extract(image);
  const charaIndex = chunks.findIndex(
    (chunk: { name: string; data: Uint8Array }) =>
      chunk.name === "tEXt" && PNGtext.decode(chunk.data).keyword.toLowerCase() === "chara",
  );

  if (charaIndex === -1) {
    throw new Error("No PNG metadata.");
  }

  const decoded = PNGtext.decode(chunks[charaIndex].data);
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
