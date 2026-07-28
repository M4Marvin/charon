import { rm } from "node:fs/promises";
import { createServerFn } from "@tanstack/react-start";
import { type } from "arktype";
import type { Character } from "@/db/schema";
import {
  deleteCharacter as repoDelete,
  getCharacter as repoGet,
  getCharacterDetail as repoGetDetail,
  searchCharacterCards as repoSearchCards,
  characterTagCounts as repoTagCounts,
  updateCharacter as repoUpdate,
  type CharacterCardItem,
  type CharacterDetail,
  type SearchParams,
} from "@/db/repositories/characters";
import type { CharacterDataV2 } from "@/lib/st-core/character";
import { getSession, isAdmin } from "@/server/session";
import { validateId } from "@/server/validators";
import { diskPathFromStored } from "@/server/uploads";
import {
  importCharacterCard,
  previewCharacterCard,
  type ImportError,
  type ImportResult,
  type PreviewResult,
} from "@/server/services/character/importer";

export type { ImportError, ImportResult, PreviewResult };

export type { CharacterCardItem };

export type CharacterListItem = CharacterCardItem;

// ── Validators (clean signatures, arktype under the hood) ───────────────────

const ImportInput = type({ pngBase64: "string > 0" });
const UpdateInput = type({ id: "string > 0", name: "string > 0" });
const UpdateDataInput = type({
  id: "string > 0",
  data: "unknown",
  tagline: "string | null | undefined",
});

const SearchInput = type({
  q: "string?",
  tags: "string?",
  sort: "string?",
  offset: "string > 0",
  limit: "string > 0",
});

function validateImportInput(data: unknown): { pngBase64: string } {
  const result = ImportInput(data);
  if (result instanceof type.errors) {
    throw new Error("Invalid import input");
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

function validateSearchInput(data: unknown): SearchParams {
  const result = SearchInput(data);
  if (result instanceof type.errors) throw new Error("Invalid search input");
  return {
    q: result.q,
    tags: result.tags ? result.tags.split(",").filter(Boolean) : undefined,
    sort: result.sort as SearchParams["sort"],
    offset: Number(result.offset),
    limit: Number(result.limit),
  };
}

// ── Server functions ────────────────────────────────────────────────────────

export const getCharacter = createServerFn({ method: "GET", strict: { output: false } })
  .validator(validateId)
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

    return importCharacterCard(data.pngBase64, user.id);
  });

export const previewCharacter = createServerFn({ method: "POST" })
  .validator(validateImportInput)
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; data: PreviewResult } | { ok: false; error: ImportError }> => {
      const { user } = await getSession();

      if (!isAdmin(user)) {
        return {
          ok: false,
          error: { kind: "demo_restricted", message: "Demo users cannot import characters." },
        };
      }

      return previewCharacterCard(data.pngBase64, user.id);
    },
  );

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
  .validator(validateId)
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
        await rm(diskPathFromStored(imagePath), { force: true });
      } catch {}
    }

    return { id: data.id };
  });

export const searchCharacters = createServerFn({ method: "GET" })
  .validator(validateSearchInput)
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return repoSearchCards(user.id, data);
  });

export const characterTagCounts = createServerFn({ method: "GET" }).handler(
  async () => {
    const { user } = await getSession();
    return repoTagCounts(user.id);
  },
);
