import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { type } from "arktype";
import { getSession } from "@/server/session";
import type { Persona } from "@/db/schema";
import {
  createPersona as repoCreate,
  deletePersona as repoDelete,
  getPersona as repoGet,
  listPersonas as repoList,
  updatePersona as repoUpdate,
  type CreatePersonaInput,
  type UpdatePersonaInput,
} from "@/db/repositories/personas";

export type PersonaListItem = Persona;

// ── Validators ──────────────────────────────────────────────────────────────

const IdInput = type({ id: "string > 0" });

const CreatePersonaInput = type({
  name: "string > 0",
  "description?": "string",
  "iconPath?": "string",
});

const UpdatePersonaInput = type({
  id: "string > 0",
  "name?": "string > 0",
  "description?": "string | null",
  "iconPath?": "string | null",
});

function validateIdInput(data: unknown): { id: string } {
  const result = IdInput(data);
  if (result instanceof type.errors) throw new Error("Invalid id");
  return result;
}

function validateCreateInput(data: unknown): {
  name: string;
  description?: string;
  iconPath?: string;
} {
  const result = CreatePersonaInput(data);
  if (result instanceof type.errors) throw new Error("Invalid persona input");
  return result;
}

function validateUpdateInput(data: unknown): {
  id: string;
  name?: string;
  description?: string | null;
  iconPath?: string | null;
} {
  const result = UpdatePersonaInput(data);
  if (result instanceof type.errors) throw new Error("Invalid persona update");
  return result;
}

// ── Server functions ────────────────────────────────────────────────────────

export const listPersonas = createServerFn({ method: "GET" }).handler(
  async (): Promise<PersonaListItem[]> => {
    const { user } = await getSession();
    return repoList(user.id);
  },
);

export const getPersona = createServerFn({ method: "GET", strict: { output: false } })
  .validator(validateIdInput)
  .handler(async ({ data }): Promise<Persona> => {
    const { user } = await getSession();
    return repoGet(user.id, data.id);
  });

export const createPersona = createServerFn({ method: "POST" })
  .validator(validateCreateInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    const id = randomUUID();
    const input: CreatePersonaInput = {
      id,
      userId: user.id,
      name: data.name,
      description: data.description ?? null,
      iconPath: data.iconPath ?? null,
    };
    repoCreate(input);
    return { id };
  });

export const updatePersona = createServerFn({ method: "POST", strict: { output: false } })
  .validator(validateUpdateInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    const patch: UpdatePersonaInput = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.iconPath !== undefined) patch.iconPath = data.iconPath;
    repoUpdate(user.id, data.id, patch);
    return { id: data.id };
  });

export const deletePersona = createServerFn({ method: "POST" })
  .validator(validateIdInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    repoDelete(user.id, data.id);
    return { id: data.id };
  });
