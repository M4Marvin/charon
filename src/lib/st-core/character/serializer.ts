import extract from "png-chunks-extract";
import PNGtext from "png-chunk-text";
import { encodePngChunks } from "./png-encode.js";

/**
 * V2 backfill warning prepended to `creator_notes` when emitting a V2
 * `chara` chunk for a card whose native spec is V3. Matches the warning
 * phrasing recommended by the V3 spec so V2-only frontends can show it.
 */
const V3_BACKFILL_WARNING = `This character card is Character Card V3, but it is loaded as a Character Card V2. Please use a Character Card V3 compatible application to use this character card properly.\n\n`;

/**
 * Write character card data into a PNG image buffer.
 *
 * For V2 cards (`spec === "chara_card_v2"`), embeds a single `chara` tEXt
 * chunk and removes any existing `chara`/`ccv3` chunks before writing.
 *
 * For V3 cards (`spec === "chara_card_v3"`), embeds **both** a `chara`
 * chunk (backfilled V2 JSON with a `creator_notes` warning) and a `ccv3`
 * chunk (the original V3 JSON). This matches the V3 spec recommendation
 * and keeps V3 cards readable by V2-only frontends.
 *
 * @param image Source PNG bytes.
 * @param data Card JSON string. The function sniffs `spec` to choose the
 *             write path; non-V2/V3 specs fall back to V2.
 */
export function writeCharacterCard(image: Uint8Array, data: string): Uint8Array {
  const chunks = extract(image);

  // Remove existing chara / ccv3 chunks (any case of the keyword).
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk.name !== "tEXt") continue;
    const kw = PNGtext.decode(chunk.data).keyword.toLowerCase();
    if (kw === "chara" || kw === "ccv3") chunks.splice(i, 1);
  }

  let spec: string | undefined;
  try {
    const parsed = JSON.parse(data) as { spec?: unknown };
    if (typeof parsed.spec === "string") spec = parsed.spec;
  } catch {
    // malformed JSON — treat as V2 below
  }

  if (spec === "chara_card_v3") {
    // `ccv3` first, then `chara` (backfilled V2 with warning). Both before IEND.
    const ccv3Base64 = Buffer.from(data, "utf8").toString("base64");
    const v2Json = backfillV2FromV3(data);
    const charaBase64 = Buffer.from(v2Json, "utf8").toString("base64");
    chunks.splice(-1, 0, PNGtext.encode("ccv3", ccv3Base64));
    chunks.splice(-1, 0, PNGtext.encode("chara", charaBase64));
  } else {
    const base64Data = Buffer.from(data, "utf8").toString("base64");
    chunks.splice(-1, 0, PNGtext.encode("chara", base64Data));
  }

  return encodePngChunks(chunks);
}

/**
 * Build a V2 JSON string from a V3 JSON string. Prepends the backfill
 * warning to `creator_notes` and resets the top-level `spec`/`spec_version`.
 * Other V3-only fields are kept verbatim — V2's `[key: string]: unknown`
 * index signatures on `data` and on the `card` itself absorb them, so a
 * V2-only frontend receives a parseable object even if it ignores them.
 */
function backfillV2FromV3(v3Data: string): string {
  const card = JSON.parse(v3Data) as Record<string, unknown>;
  const data = (card.data ?? {}) as Record<string, unknown>;
  const existing = typeof data.creator_notes === "string" ? data.creator_notes : "";
  card.spec = "chara_card_v2";
  card.spec_version = "2.0";
  data.creator_notes = V3_BACKFILL_WARNING + existing;
  card.data = data;
  return JSON.stringify(card);
}
