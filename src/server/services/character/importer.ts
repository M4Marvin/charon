import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import {
  createCharacter as repoCreate,
  listCharacters as repoList,
} from "@/db/repositories/characters";
import {
  parseCharacterCard,
  validateCharacterCard,
  validateCharacterCardV3,
} from "@/lib/st-core/character";
import { normalizeCardData, normalizeV3ToV2 } from "@/lib/character/normalize";
import type { CharacterDataV2 } from "@/lib/st-core/character";
import {
  ensureUploadsDirs,
  diskPathFromStored,
  storedPathFromDiskComponents,
} from "@/server/uploads";
import type { DB } from "@/db";

export type ImportError =
  | { kind: "demo_restricted"; message: string }
  | { kind: "invalid_png"; message: string }
  | { kind: "validation"; errors: { field: string; message: string }[] }
  | { kind: "save_failed"; message: string };

export type ImportResult =
  | { ok: true; character: { id: string; name: string; imagePath: string | null } }
  | { ok: false; error: ImportError };

export type ParsedCard = {
  cardData: CharacterDataV2;
  spec: "chara_card_v2" | "chara_card_v3";
  specVersion: "2.0" | "3.0";
  pngBytes: Uint8Array;
};

export function parseAndValidateCard(
  pngBase64: string,
): { ok: true; parsed: ParsedCard } | { ok: false; error: ImportError } {
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

  return {
    ok: true,
    parsed: {
      cardData: validation.card.data as CharacterDataV2,
      spec: isV3 ? "chara_card_v3" : "chara_card_v2",
      specVersion: isV3 ? "3.0" : "2.0",
      pngBytes,
    },
  };
}

export type PreviewResult = {
  preview: {
    name: string;
    creator: string;
    descriptionExcerpt: string;
    tags: string[];
    spec: string;
    specVersion: string;
    greetingCount: number;
    lorebookEntryCount: number;
    warnings: string[];
  };
  duplicateOf: { id: string; name: string } | null;
};

export function previewCharacterCard(
  pngBase64: string,
  userId: string,
  db?: DB,
): { ok: true; data: PreviewResult } | { ok: false; error: ImportError } {
  const parsed = parseAndValidateCard(pngBase64);
  if (!parsed.ok) return parsed;

  const { cardData, spec, specVersion } = parsed.parsed;

  const warnings: string[] = [];
  if (!cardData.description) warnings.push("No description on card");
  if (spec === "chara_card_v3") warnings.push("V3 card — data normalized to V2 for compatibility");

  const descriptionExcerpt = (cardData.description || "").slice(0, 280);

  const duplicate = repoList(userId, db).find(
    (c) => c.name.toLowerCase() === cardData.name.toLowerCase(),
  );

  return {
    ok: true,
    data: {
      preview: {
        name: cardData.name,
        creator: cardData.creator ?? "",
        descriptionExcerpt,
        tags: cardData.tags ?? [],
        spec,
        specVersion,
        greetingCount: cardData.alternate_greetings?.length ?? 0,
        lorebookEntryCount: cardData.character_book?.entries?.length ?? 0,
        warnings,
      },
      duplicateOf: duplicate ? { id: duplicate.id, name: duplicate.name } : null,
    },
  };
}

export async function importCharacterCard(
  pngBase64: string,
  userId: string,
): Promise<ImportResult> {
  const parsed = parseAndValidateCard(pngBase64);
  if (!parsed.ok) return parsed;

  const { cardData, spec, specVersion, pngBytes } = parsed.parsed;

  const id = randomUUID();
  const filename = `${id}.png`;
  const storedPath = storedPathFromDiskComponents("avatars", filename);
  const writePath = diskPathFromStored(storedPath);

  try {
    await ensureUploadsDirs();
    await writeFile(writePath, pngBytes);
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
    const character = repoCreate({
      id,
      userId,
      name: cardData.name,
      data: cardData,
      imagePath: storedPath,
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
      await rm(writePath);
    } catch {
      // best-effort
    }
    throw e;
  }
}
