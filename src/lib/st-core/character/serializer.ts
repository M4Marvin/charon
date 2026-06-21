import extract from 'png-chunks-extract';
import PNGtext from 'png-chunk-text';
import { encodePngChunks } from './png-encode.js';

/**
 * Write character card data into a PNG image buffer.
 * Embeds a `chara` (V2) tEXt chunk. Also attempts to embed a `ccv3` (V3) chunk
 * by rewriting the `spec` and `spec_version` fields.
 * Removes any existing `chara` or `ccv3` chunks before writing.
 */
export function writeCharacterCard(image: Uint8Array, data: string): Uint8Array {
  const chunks = extract(image);
  const textChunks = chunks.filter((chunk: { name: string }) => chunk.name === 'tEXt');

  // Remove existing chara/ccv3 chunks
  for (const tEXtChunk of textChunks) {
    const decoded = PNGtext.decode(tEXtChunk.data);
    const kw = decoded.keyword.toLowerCase();
    if (kw === 'chara' || kw === 'ccv3') {
      const idx = chunks.indexOf(tEXtChunk);
      if (idx !== -1) chunks.splice(idx, 1);
    }
  }

  // Add V2 chunk before IEND
  const base64Data = Buffer.from(data, 'utf8').toString('base64');
  chunks.splice(-1, 0, PNGtext.encode('chara', base64Data));

  // Try adding V3 chunk before IEND
  try {
    const v3Data = JSON.parse(data) as Record<string, unknown>;
    v3Data.spec = 'chara_card_v3';
    v3Data.spec_version = '3.0';
    const v3Base64 = Buffer.from(JSON.stringify(v3Data), 'utf8').toString('base64');
    chunks.splice(-1, 0, PNGtext.encode('ccv3', v3Base64));
  } catch {
    // Non-critical: V3 chunk is optional
  }

  return encodePngChunks(chunks);
}
