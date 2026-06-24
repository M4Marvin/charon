import extract from "png-chunks-extract";
import PNGtext from "png-chunk-text";
import { encodePngChunks } from "./png-encode.js";

/**
 * Write character card data into a PNG image buffer.
 * Embeds a `chara` (V2) tEXt chunk. Removes any existing `chara` chunks before writing.
 */
export function writeCharacterCard(image: Uint8Array, data: string): Uint8Array {
  const chunks = extract(image);

  // Remove existing chara chunks
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk.name === "tEXt") {
      const kw = PNGtext.decode(chunk.data).keyword.toLowerCase();
      if (kw === "chara") chunks.splice(i, 1);
    }
  }

  // Add chara chunk before IEND
  const base64Data = Buffer.from(data, "utf8").toString("base64");
  chunks.splice(-1, 0, PNGtext.encode("chara", base64Data));

  return encodePngChunks(chunks);
}
