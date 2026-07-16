import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCharacter as repoCreate } from "@/db/repositories/characters";
import {
  parseCharacterCard,
  validateCharacterCard,
  validateCharacterCardV3,
} from "@/lib/st-core/character";
import { normalizeCardData, normalizeV3ToV2 } from "@/lib/character/normalize";
import type { CharacterDataV2 } from "@/lib/st-core/character";

const AVATAR_DIR = "data/avatars";

export type ImportError =
  | { kind: "demo_restricted"; message: string }
  | { kind: "invalid_png"; message: string }
  | { kind: "validation"; errors: { field: string; message: string }[] }
  | { kind: "save_failed"; message: string };

export type ImportResult =
  | { ok: true; character: { id: string; name: string; imagePath: string | null } }
  | { ok: false; error: ImportError };

export async function importCharacterCard(
  pngBase64: string,
  userId: string,
): Promise<ImportResult> {
  let pngBytes: Uint8Array;
  try {
    pngBytes = new Uint8Array(Buffer.from(pngBase64, "base64"));
  } catch (e) {
    return {
      ok: false,
      error: {
        kind: "invalid_png",
        message: e instanceof Error ? e.message : "Failed to decode base64",
      },
    };
  }

  let raw: unknown;
  try {
    raw = parseCharacterCard(pngBytes);
  } catch (e) {
    return {
      ok: false,
      error: {
        kind: "invalid_png",
        message: e instanceof Error ? e.message : "Invalid character card PNG",
      },
    };
  }

  raw = normalizeCardData(raw);

  const detectedSpec =
    typeof (raw as { spec?: unknown }).spec === "string"
      ? (raw as { spec: string }).spec
      : "chara_card_v2";
  const isV3 = detectedSpec === "chara_card_v3";

  if (isV3) {
    raw = normalizeV3ToV2(raw);
  }

  const validation = isV3 ? validateCharacterCardV3(raw) : validateCharacterCard(raw);
  if (!validation.ok) {
    return { ok: false, error: { kind: "validation", errors: validation.errors } };
  }

  const id = randomUUID();
  const imagePath = join(AVATAR_DIR, `${id}.png`);

  try {
    await mkdir(AVATAR_DIR, { recursive: true });
    await writeFile(imagePath, pngBytes);
  } catch (e) {
    return {
      ok: false,
      error: {
        kind: "save_failed",
        message: e instanceof Error ? e.message : "Failed to write avatar",
      },
    };
  }

  try {
    const cardData = validation.card.data as CharacterDataV2;
    const spec: "chara_card_v2" | "chara_card_v3" = isV3 ? "chara_card_v3" : "chara_card_v2";
    const specVersion = isV3 ? "3.0" : "2.0";
    const character = repoCreate({
      id,
      userId,
      name: cardData.name,
      data: cardData,
      imagePath,
      spec,
      specVersion,
    });
    return {
      ok: true,
      character: {
        id: character.id,
        name: character.name,
        imagePath: character.imagePath,
      },
    };
  } catch (e) {
    try {
      await rm(imagePath);
    } catch {
      // best-effort
    }
    throw e;
  }
}
