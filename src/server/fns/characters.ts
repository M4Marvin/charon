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
  getCharacterDetail as repoGetDetail,
  listCharacterCards as repoListCards,
  updateCharacter as repoUpdate,
  type CharacterDetail,
} from "@/db/repositories/characters";
import type { CharacterDataV2 } from "@/lib/st-core/character";
import {
  parseCharacterCard,
  validateCharacterCard,
  validateCharacterCardV3,
} from "@/lib/st-core/character";
import { normalizeCardData, normalizeV3ToV2 } from "@/lib/character/normalize";
import { getSession, isAdmin } from "@/server/session";

const AVATAR_DIR = "data/avatars";

// ── Shared types ────────────────────────────────────────────────────────────

export type ImportError =
  | { kind: "demo_restricted"; message: string }
  | { kind: "invalid_png"; message: string }
  | { kind: "validation"; errors: { field: string; message: string }[] }
  | { kind: "save_failed"; message: string };

export type ImportResult =
  | { ok: true; character: { id: string; name: string; imagePath: string | null } }
  | { ok: false; error: ImportError };

export type CharacterListItem = Pick<
  Character,
  "id" | "name" | "spec" | "specVersion" | "imagePath" | "tagline" | "createdAt" | "updatedAt"
> & {
  tags: string[];
  creatorNotes: string;
  creator: string;
  chatCount: number;
};

// ── Validators (clean signatures, arktype under the hood) ───────────────────

const ImportInput = type({ pngBase64: "string > 0" });
const IdInput = type({ id: "string > 0" });
const UpdateInput = type({ id: "string > 0", name: "string > 0" });
const UpdateDataInput = type({
  id: "string > 0",
  data: "unknown",
  tagline: "string | null | undefined",
});

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

function validateUpdateDataInput(data: unknown): {
  id: string;
  data: CharacterDataV2;
  tagline?: string | null;
} {
  const result = UpdateDataInput(data);
  if (result instanceof type.errors) {
    throw new Error("Invalid update data input");
  }
  return result as { id: string; data: CharacterDataV2; tagline?: string | null };
}

// ── Server functions ────────────────────────────────────────────────────────

export const listCharacters = createServerFn({ method: "GET" }).handler(
  async (): Promise<CharacterListItem[]> => {
    const { user } = await getSession();
    return repoListCards(user.id);
  },
);

export const getCharacter = createServerFn({ method: "GET", strict: { output: false } })
  .validator(validateIdInput)
  .handler(async ({ data }): Promise<CharacterDetail> => {
    const { user } = await getSession();
    return repoGetDetail(user.id, data.id);
  });

export const importCharacter = createServerFn({ method: "POST" })
  .validator(validateImportInput)
  .handler(async ({ data }): Promise<ImportResult> => {
    const { user } = await getSession();

    if (!isAdmin(user)) {
      return {
        ok: false,
        error: { kind: "demo_restricted", message: "Demo users cannot import characters." },
      };
    }

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

    // Detect the spec from the parsed JSON before V3 projection.
    const detectedSpec =
      typeof (raw as { spec?: unknown }).spec === "string"
        ? (raw as { spec: string }).spec
        : "chara_card_v2";
    const isV3 = detectedSpec === "chara_card_v3";

    // V3 → V2 projection. V3 cards carry V3-only fields that the V2
    // arktype gate would reject; normalizeV3ToV2 stashes them under
    // `data.extensions._v3` so the card remains round-trippable on
    // export. The top-level `spec`/`spec_version` stay V3, so we run
    // the V3 validator instead of the V2 strict gate for V3 cards.
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
        userId: user.id,
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
  });

export const updateCharacter = createServerFn({ method: "POST", strict: { output: false } })
  .validator(validateUpdateInput)
  .handler(async ({ data }): Promise<Character> => {
    const { user } = await getSession();
    if (!isAdmin(user)) throw new Error("Demo users cannot rename characters.");
    return repoUpdate(user.id, data.id, { name: data.name });
  });

export const updateCharacterData = createServerFn({ method: "POST", strict: { output: false } })
  .validator(validateUpdateDataInput)
  .handler(async ({ data }): Promise<Character> => {
    const { user } = await getSession();
    if (!isAdmin(user)) throw new Error("Demo users cannot edit characters.");
    return repoUpdate(user.id, data.id, {
      name: data.data.name,
      data: data.data,
      tagline: data.tagline ?? null,
    });
  });

export const deleteCharacter = createServerFn({ method: "POST" })
  .validator(validateIdInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    if (!isAdmin(user)) throw new Error("Demo users cannot delete characters.");

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
