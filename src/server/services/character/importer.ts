import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import {
  createCharacter as repoCreate,
  listCharacters as repoList,
} from "@/db/repositories/characters";
import {
  createLorebook as repoCreateLorebook,
  createEntry as repoCreateLoreEntry,
  listLorebooks as repoListLorebooks,
} from "@/db/repositories/lorebooks";
import {
  parseCharacterCard,
  validateCharacterCard,
  validateCharacterCardV3,
} from "@/lib/st-core/character";
import { normalizeCardData, normalizeV3ToV2 } from "@/lib/character/normalize";
import { deriveDisplayName } from "@/lib/character/chub-name";
import { convertCharacterBookToStandalone } from "@/lib/lorebook/embedded-book";
import type { CharacterDataV2 } from "@/lib/st-core/character";
import {
  ensureUploadsDirs,
  diskPathFromStored,
  storedPathFromDiskComponents,
} from "@/server/uploads";
import {
  decodeImageBase64,
  validatePngDimensions,
  validateUploadedImage,
} from "@/server/image-limits";
import type { DB } from "@/db";

export type ImportError =
  | { kind: "invalid_png"; message: string }
  | { kind: "validation"; errors: { field: string; message: string }[] }
  | { kind: "save_failed"; message: string };

export type ImportedLorebook = {
  id: string;
  name: string;
  entriesInserted: number;
  entriesSkipped: number;
};

export type ImportResult =
  | {
      ok: true;
      character: { id: string; name: string; imagePath: string | null };
      lorebook?: ImportedLorebook | null;
    }
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
    const bytes = decodeImageBase64(pngBase64);
    validatePngDimensions(bytes);
    pngBytes = bytes;
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

type InvalidPngError = Extract<ImportError, { kind: "invalid_png" }>;

async function validateCharacterPngPixels(pngBytes: Uint8Array): Promise<InvalidPngError | null> {
  try {
    const metadata = await validateUploadedImage(pngBytes);
    if (metadata.format === "png") return null;
    return { kind: "invalid_png", message: "Character cards must be PNG" };
  } catch (error) {
    return {
      kind: "invalid_png",
      message: error instanceof Error ? error.message : "Invalid character card PNG",
    };
  }
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

export async function previewCharacterCard(
  pngBase64: string,
  db?: DB,
): Promise<{ ok: true; data: PreviewResult } | { ok: false; error: ImportError }> {
  const parsed = parseAndValidateCard(pngBase64);
  if (!parsed.ok) return parsed;
  const pixelError = await validateCharacterPngPixels(parsed.parsed.pngBytes);
  if (pixelError) return { ok: false, error: pixelError };

  const { cardData, spec, specVersion } = parsed.parsed;

  const warnings: string[] = [];
  if (!cardData.description) warnings.push("No description on card");
  if (spec === "chara_card_v3") warnings.push("V3 card — data normalized to V2 for compatibility");

  const descriptionExcerpt = (cardData.description || "").slice(0, 280);

  const name = deriveDisplayName(cardData);
  const duplicate = repoList(db).find((c) => c.name.toLowerCase() === name.toLowerCase());

  return {
    ok: true,
    data: {
      preview: {
        name,
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

export async function importCharacterCard(pngBase64: string, db?: DB): Promise<ImportResult> {
  const parsed = parseAndValidateCard(pngBase64);
  if (!parsed.ok) return parsed;
  const pixelError = await validateCharacterPngPixels(parsed.parsed.pngBytes);
  if (pixelError) return { ok: false, error: pixelError };

  const { cardData, spec, specVersion, pngBytes } = parsed.parsed;

  const name = deriveDisplayName(cardData);

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

  let character: ReturnType<typeof repoCreate>;
  try {
    character = repoCreate(
      {
        id,
        name,
        data: cardData,
        imagePath: storedPath,
        spec,
        specVersion,
      },
      db,
    );
  } catch (e) {
    try {
      await rm(writePath);
    } catch {
      // best-effort
    }
    throw e;
  }

  let lorebook: ImportedLorebook | null = null;
  try {
    if (cardData.character_book?.entries?.length) {
      const standalone = convertCharacterBookToStandalone(cardData.character_book, name);
      if (standalone.entries.length > 0) {
        const exists = repoListLorebooks(db).some((lb) => lb.name === standalone.name);
        if (!exists) {
          const lbId = randomUUID();
          repoCreateLorebook(
            {
              id: lbId,
              name: standalone.name,
              description: standalone.description,
              config: standalone.config,
            },
            db,
          );
          let entriesInserted = 0;
          for (const entry of standalone.entries) {
            try {
              repoCreateLoreEntry(
                { id: randomUUID(), lorebookId: lbId, uid: entry.uid, data: entry },
                db,
              );
              entriesInserted++;
            } catch {
              /* (lorebookId, uid) collision — skip this entry */
            }
          }
          lorebook = {
            id: lbId,
            name: standalone.name,
            entriesInserted,
            entriesSkipped:
              standalone.entriesSkipped + (standalone.entries.length - entriesInserted),
          };
        }
      }
    }
  } catch {
    // Embedded lorebooks are optional; the character row and avatar are already committed.
  }

  return {
    ok: true,
    character: {
      id: character.id,
      name: character.name,
      imagePath: character.imagePath,
    },
    lorebook,
  };
}
