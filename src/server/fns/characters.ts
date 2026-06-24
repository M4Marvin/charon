import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createServerFn } from "@tanstack/react-start";
import { type } from "arktype";
import type { Character } from "@/db/schema";
import {
  createCharacter as repoCreate,
  deleteCharacter as repoDelete,
  getCharacter as repoGet,
  listCharacters as repoList,
  updateCharacter as repoUpdate,
} from "@/db/repositories/characters";
import type { CharacterDataV2 } from "@/lib/st-core/character";
import { parseCharacterCard, validateCharacterCard } from "@/lib/st-core/character";
import { normalizeCardData } from "@/lib/character/normalize";
import { getSession } from "@/server/session";

const AVATAR_DIR = "data/avatars";

// ── Shared types ────────────────────────────────────────────────────────────

export type ImportError =
  | { kind: "invalid_png"; message: string }
  | { kind: "validation"; errors: { field: string; message: string }[] }
  | { kind: "save_failed"; message: string };

export type ImportResult =
  | { ok: true; character: { id: string; name: string; imagePath: string | null } }
  | { ok: false; error: ImportError };

export type CharacterListItem = Pick<
  Character,
  "id" | "name" | "spec" | "specVersion" | "imagePath" | "createdAt" | "updatedAt"
>;

// ── Validators (clean signatures, arktype under the hood) ───────────────────

const ImportInput = type({ pngBase64: "string > 0" });
const IdInput = type({ id: "string > 0" });
const UpdateInput = type({ id: "string > 0", name: "string > 0" });

function validateImportInput(data: unknown): { pngBase64: string } {
  const result = ImportInput(data);
  if (result instanceof type.errors) {
    throw new Error("Invalid import input");
  }
  return result;
}

function validateIdInput(data: unknown): { id: string } {
  const result = IdInput(data);
  if (result instanceof type.errors) {
    throw new Error("Invalid id");
  }
  return result;
}

function validateUpdateInput(data: unknown): { id: string; name: string } {
  const result = UpdateInput(data);
  if (result instanceof type.errors) {
    throw new Error("Invalid update input");
  }
  return result;
}

// ── Server functions ────────────────────────────────────────────────────────

export const listCharacters = createServerFn({ method: "GET" }).handler(
  async (): Promise<CharacterListItem[]> => {
    const { user } = await getSession();
    return repoList(user.id).map(({ data: _data, ...rest }) => rest);
  },
);

export const getCharacter = createServerFn({ method: "GET", strict: { output: false } })
  .validator(validateIdInput)
  .handler(async ({ data }): Promise<Character> => {
    const { user } = await getSession();
    return repoGet(user.id, data.id);
  });

export const importCharacter = createServerFn({ method: "POST" })
  .validator(validateImportInput)
  .handler(async ({ data }): Promise<ImportResult> => {
    const { user } = await getSession();

    let pngBytes: Uint8Array;
    try {
      pngBytes = new Uint8Array(Buffer.from(data.pngBase64, "base64"));
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

    const validation = validateCharacterCard(raw);
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
      const character = repoCreate({
        id,
        userId: user.id,
        name: cardData.name,
        data: cardData,
        imagePath,
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
  });

export const updateCharacter = createServerFn({ method: "POST", strict: { output: false } })
  .validator(validateUpdateInput)
  .handler(async ({ data }): Promise<Character> => {
    const { user } = await getSession();
    return repoUpdate(user.id, data.id, { name: data.name });
  });

export const deleteCharacter = createServerFn({ method: "POST" })
  .validator(validateIdInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();

    let imagePath: string | null = null;
    try {
      const char = repoGet(user.id, data.id);
      imagePath = char.imagePath;
    } catch {
      // Character may already be gone; fall through to delete attempt
    }

    repoDelete(user.id, data.id);

    if (imagePath) {
      try {
        await rm(imagePath);
      } catch {
        // best-effort cleanup
      }
    }

    return { id: data.id };
  });
