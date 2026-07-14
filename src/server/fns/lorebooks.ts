import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { type } from "arktype";
import {
  LoreConfigSchema,
  LoreEntrySchema,
  DEFAULT_LORE_CONFIG,
  type LoreConfig,
  type LoreEntry as LoreEntryData,
} from "@/lib/st-core/lorebook";
import { DEFAULT_ENTRY_DRAFT } from "@/server/services/lorebook/defaults";
import { importWorldFile } from "@/server/services/lorebook/importer";
import type { Lorebook, LoreEntry } from "@/db/schema";
import {
  createEntry as repoCreateEntry,
  createLorebook as repoCreate,
  deleteEntry as repoDeleteEntry,
  deleteLorebook as repoDelete,
  getLorebook as repoGet,
  listEntries as repoListEntries,
  listLorebooks as repoList,
  nextEntryUid as repoNextEntryUid,
  updateEntry as repoUpdateEntry,
  updateLorebook as repoUpdate,
  type LorebookWithCount,
} from "@/db/repositories/lorebooks";
import { getSession } from "@/server/session";
import { validateId } from "@/server/validators";

export type LorebookListItem = LorebookWithCount;

export type LoreEntryListItem = Pick<
  LoreEntry,
  "id" | "uid" | "data" | "lorebookId" | "createdAt" | "updatedAt"
> & {
  userDisabled: boolean;
};

// ── Validators ──────────────────────────────────────────────────────────────

const LorebookIdInput = type({ lorebookId: "string > 0" });
const EntryRefInput = type({ lorebookId: "string > 0", entryId: "string > 0" });

const CreateLorebookInput = type({
  name: "string > 0",
  "description?": "string",
});

const UpdateLorebookInput = type({
  id: "string > 0",
  "name?": "string > 0",
  "description?": "string | null",
  "config?": "unknown",
});

const CreateEntryInput = type({
  lorebookId: "string > 0",
  comment: "string",
  content: "string > 0",
  key: "string[]",
  "keysecondary?": "string[]",
  "order?": "number",
  "position?": "number.integer",
  "disable?": "boolean",
  "constant?": "boolean",
  "selective?": "boolean",
  "depth?": "number.integer",
  "selectiveLogic?": "number.integer",
  "group?": "string",
  "groupOverride?": "boolean",
  "groupWeight?": "number",
  "probability?": "number",
  "useProbability?": "boolean",
});

const UpdateEntryInput = type({
  lorebookId: "string > 0",
  entryId: "string > 0",
  "uid?": "number.integer",
  data: "unknown",
});

function validateLorebookIdInput(data: unknown): { lorebookId: string } {
  const result = LorebookIdInput(data);
  if (result instanceof type.errors) throw new Error("Invalid lorebookId");
  return result;
}

function validateEntryRefInput(data: unknown): { lorebookId: string; entryId: string } {
  const result = EntryRefInput(data);
  if (result instanceof type.errors) throw new Error("Invalid entry reference");
  return result;
}

function validateCreateLorebookInput(data: unknown): {
  name: string;
  description?: string;
} {
  const result = CreateLorebookInput(data);
  if (result instanceof type.errors) throw new Error("Invalid lorebook input");
  return result;
}

function validateUpdateLorebookInput(data: unknown): {
  id: string;
  name?: string;
  description?: string | null;
  config?: unknown;
} {
  const result = UpdateLorebookInput(data);
  if (result instanceof type.errors) throw new Error("Invalid lorebook update");
  if (result.config !== undefined) {
    const cfg = LoreConfigSchema(result.config);
    if (cfg instanceof type.errors) throw new Error("Invalid lorebook config");
    return { ...result, config: cfg };
  }
  return result;
}

type CreateEntryInput = {
  lorebookId: string;
  comment: string;
  content: string;
  key: string[];
  keysecondary?: string[];
  order?: number;
  position?: number;
  disable?: boolean;
  constant?: boolean;
  selective?: boolean;
  depth?: number;
  selectiveLogic?: number;
  group?: string;
  groupOverride?: boolean;
  groupWeight?: number;
  probability?: number;
  useProbability?: boolean;
};

function validateCreateEntryInput(data: unknown): CreateEntryInput {
  const result = CreateEntryInput(data);
  if (result instanceof type.errors) throw new Error("Invalid entry input");
  return result;
}

const ImportLorebookInput = type({
  content: "string > 0",
});

function validateImportLorebookInput(data: unknown): { content: string } {
  const result = ImportLorebookInput(data);
  if (result instanceof type.errors) throw new Error("Invalid import input");
  return result;
}

function validateUpdateEntryInput(data: unknown): {
  lorebookId: string;
  entryId: string;
  uid?: number;
  data: LoreEntryData;
} {
  const result = UpdateEntryInput(data);
  if (result instanceof type.errors) throw new Error("Invalid entry update");
  const entryResult = LoreEntrySchema(result.data);
  if (entryResult instanceof type.errors) throw new Error("Invalid entry data");
  return { ...result, data: entryResult as LoreEntryData };
}

// ── Server functions ────────────────────────────────────────────────────────

export const listLorebooks = createServerFn({ method: "GET" }).handler(
  async (): Promise<LorebookListItem[]> => {
    const { user } = await getSession();
    return repoList(user.id);
  },
);

export const getLorebook = createServerFn({ method: "GET", strict: { output: false } })
  .validator(validateId)
  .handler(async ({ data }): Promise<Lorebook> => {
    const { user } = await getSession();
    return repoGet(user.id, data.id);
  });

export const createLorebook = createServerFn({ method: "POST" })
  .validator(validateCreateLorebookInput)
  .handler(async ({ data }): Promise<{ id: string; name: string }> => {
    const { user } = await getSession();
    const id = randomUUID();
    const row = repoCreate({
      id,
      userId: user.id,
      name: data.name,
      description: data.description ?? null,
      config: { ...DEFAULT_LORE_CONFIG } as LoreConfig,
    });
    return { id: row.id, name: row.name };
  });

export const updateLorebook = createServerFn({ method: "POST", strict: { output: false } })
  .validator(validateUpdateLorebookInput)
  .handler(async ({ data }): Promise<Lorebook> => {
    const { user } = await getSession();
    const patch: Partial<Pick<Lorebook, "name" | "description" | "config">> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.config !== undefined) patch.config = data.config as LoreConfig;
    return repoUpdate(user.id, data.id, patch);
  });

export const deleteLorebook = createServerFn({ method: "POST" })
  .validator(validateId)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    repoDelete(user.id, data.id);
    return { id: data.id };
  });

export const listLorebookEntries = createServerFn({ method: "GET" })
  .validator(validateLorebookIdInput)
  .handler(async ({ data }): Promise<LoreEntryListItem[]> => {
    const { user } = await getSession();
    return repoListEntries(user.id, data.lorebookId).map((e) => ({
      id: e.id,
      uid: e.uid,
      data: e.data,
      lorebookId: e.lorebookId,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      userDisabled: e.userDisabled,
    }));
  });

export const createLorebookEntry = createServerFn({ method: "POST" })
  .validator(validateCreateEntryInput)
  .handler(async ({ data }): Promise<{ id: string; uid: number }> => {
    const { user } = await getSession();
    const uid = repoNextEntryUid(user.id, data.lorebookId);
    const draft = {
      ...DEFAULT_ENTRY_DRAFT,
      uid,
      key: data.key,
      keysecondary: data.keysecondary ?? [],
      comment: data.comment,
      content: data.content,
      constant: data.constant ?? false,
      selective: data.selective ?? false,
      order: data.order ?? 100,
      position: data.position ?? 0,
      disable: data.disable ?? false,
      depth: data.depth ?? 4,
      selectiveLogic: data.selectiveLogic ?? 0,
      group: data.group ?? "",
      groupOverride: data.groupOverride ?? false,
      groupWeight: data.groupWeight ?? 100,
      probability: data.probability ?? 100,
      useProbability: data.useProbability ?? false,
      triggers: [] as string[],
    };
    const validated = LoreEntrySchema(draft);
    if (validated instanceof type.errors) throw new Error("Invalid entry data");
    const row = repoCreateEntry(user.id, {
      id: randomUUID(),
      lorebookId: data.lorebookId,
      uid,
      data: validated as LoreEntryData,
    });
    return { id: row.id, uid: row.uid };
  });

export const updateLorebookEntry = createServerFn({ method: "POST", strict: { output: false } })
  .validator(validateUpdateEntryInput)
  .handler(async ({ data }): Promise<LoreEntry> => {
    const { user } = await getSession();
    const patch: Partial<Pick<LoreEntry, "uid" | "data">> = { data: data.data };
    if (data.uid !== undefined) patch.uid = data.uid;
    return repoUpdateEntry(user.id, data.lorebookId, data.entryId, patch);
  });

export const deleteLorebookEntry = createServerFn({ method: "POST" })
  .validator(validateEntryRefInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    repoDeleteEntry(user.id, data.lorebookId, data.entryId);
    return { id: data.entryId };
  });

// Import a SillyTavern world-info JSON file. Creates the lorebook (disabled
// by default per the opt-in design) and inserts all valid entries. Returns
// counts so the client can report skipped entries.
export const importLorebook = createServerFn({ method: "POST" })
  .validator(validateImportLorebookInput)
  .handler(
    async ({
      data,
    }): Promise<{
      id: string;
      name: string;
      entriesInserted: number;
      entriesSkipped: number;
    }> => {
      const { user } = await getSession();
      return importWorldFile(data.content, user.id);
    },
  );
