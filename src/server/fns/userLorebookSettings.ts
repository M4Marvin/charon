import { createServerFn } from "@tanstack/react-start";
import { type } from "arktype";
import { getSession } from "@/server/session";
import {
  getLorebook as repoGetLorebook,
  listEntries as repoListEntries,
} from "@/db/repositories/lorebooks";
import {
  setLorebookEnabled as repoSetLorebookEnabled,
  setLoreEntryDisabled as repoSetLoreEntryDisabled,
} from "@/db/repositories/userLorebookSettings";

// ── Validators ──────────────────────────────────────────────────────────────

const SetLorebookEnabledInput = type({
  lorebookId: "string > 0",
  enabled: "boolean",
});

const SetLoreEntryDisabledInput = type({
  lorebookId: "string > 0",
  entryId: "string > 0",
  disabled: "boolean",
});

function validateSetLorebookEnabled(data: unknown): {
  lorebookId: string;
  enabled: boolean;
} {
  const result = SetLorebookEnabledInput(data);
  if (result instanceof type.errors) throw new Error("Invalid input");
  return result;
}

function validateSetLoreEntryDisabled(data: unknown): {
  lorebookId: string;
  entryId: string;
  disabled: boolean;
} {
  const result = SetLoreEntryDisabledInput(data);
  if (result instanceof type.errors) throw new Error("Invalid input");
  return result;
}

// ── Server functions ────────────────────────────────────────────────────────

// Both mutations verify lorebook ownership via getLorebook, which throws
// "Lorebook not found" for wrong-user or missing rows.

export const setLorebookEnabled = createServerFn({ method: "POST" })
  .validator(validateSetLorebookEnabled)
  .handler(async ({ data }): Promise<{ lorebookId: string; enabled: boolean }> => {
    const { user } = await getSession();
    // Ownership check: throws on wrong user / missing.
    repoGetLorebook(user.id, data.lorebookId);
    repoSetLorebookEnabled(user.id, data.lorebookId, data.enabled);
    return { lorebookId: data.lorebookId, enabled: data.enabled };
  });

export const setLoreEntryDisabled = createServerFn({ method: "POST" })
  .validator(validateSetLoreEntryDisabled)
  .handler(async ({ data }): Promise<{ entryId: string; disabled: boolean }> => {
    const { user } = await getSession();
    // Transitive ownership: getLorebook throws on wrong user / missing.
    repoGetLorebook(user.id, data.lorebookId);
    // Ensure the entry actually belongs to this lorebook before touching
    // the overlay row.
    const entries = repoListEntries(user.id, data.lorebookId);
    if (!entries.some((e) => e.id === data.entryId)) {
      throw new Error("Lore entry not found");
    }
    repoSetLoreEntryDisabled(user.id, data.entryId, data.disabled);
    return { entryId: data.entryId, disabled: data.disabled };
  });
