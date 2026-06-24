# Character Import (V2 PNG + Legacy Migration)

Two paths to get a character into `dev.db`:

1. **V2 import via the app** — user uploads a PNG in the browser, server validates + writes to disk + inserts row.
2. **Legacy migration** — `scripts/migrate-data.ts` reads `public/data/` (a SillyTavern v1.18.0 export) and bulk-loads characters, lorebooks, and personas.

Both paths use the same downstream pieces (`parseCharacterCard`, `validateCharacterCard`, `data/avatars/` directory, `characters` table), but with different validation strictness — the import fn is strict, the migration normalizes legacy quirks first.

---

## V2 import flow (app)

### End-to-end sequence

```
[Browser]                                    [Server]                                  [Disk]
─────────                                    ───────                                  ─────

User picks .png
↓
file.arrayBuffer()
↓
fileToBase64()        ──base64 string──►     importCharacter({ data: { pngBase64 }})
                                            ↓ getSession() → userId
                                            ↓ Buffer.from(base64) → Uint8Array
                                            ↓ parseCharacterCard(bytes)
                                            ↓ validateCharacterCard(raw)  [arktype]
                                            ↓ mkdir(data/avatars, recursive)
                                            ↓ writeFile(data/avatars/<uuid>.png)
                                            ↓ repoCreate({ id, userId, name,
                                            ↓            data, imagePath })
                                            │
                                            │ on DB failure:
                                            │   rm(avatarPath)  ← orphan cleanup
                                            │
                       ←{ ok, character } ←─┘
↓
onSuccess: invalidateQueries(['characters'])
↓
router.navigate('/characters')
```

### Code locations

| Layer | File | What |
|---|---|---|
| Route | `src/routes/characters/new.tsx` | file input form, `fileToBase64` call, error surface |
| Hook | `src/hooks/useCharacters.ts` | `useImportCharacter` mutation, `invalidateQueries` on success |
| Server fn | `src/server/fns/characters.ts` | `importCharacter` — auth, base64 decode, parse, validate, write, insert |
| Repository | `src/db/repositories/characters.ts` | `createCharacter` |
| Schema | `src/db/schema.ts:89` | `characters` table |
| API route | `src/routes/api/characters/$id/avatar.ts` | streams PNG bytes from `data/avatars/<id>.png` |

### Error surface (client)

`importCharacter` returns a discriminated `ImportResult` rather than throwing, so the client can show validation errors inline:

```ts
type ImportError =
  | { kind: "invalid_png"; message: string }    // not a PNG, or no chara chunk, or V3-only
  | { kind: "validation"; errors: { field: string; message: string }[] }  // arktype failures
  | { kind: "save_failed"; message: string };   // disk write failed

type ImportResult =
  | { ok: true; character: { id; name; imagePath } }
  | { ok: false; error: ImportError };
```

Auth errors (`getSession()` throws) are NOT caught — they propagate through TanStack Start as a thrown error in the mutation, which TanStack Query exposes via `mutation.isError`.

### Validation (strict — the user-facing path)

`validateCharacterCard(raw)` from `@/lib/st-core/character`:

- Requires `spec: "chara_card_v2"` and `spec_version: "2.0"`. V3 cards (`spec: "chara_card_v3"`) are rejected — the parser doesn't read `ccv3` chunks at all.
- Requires all V2 fields on `data` (name, description, personality, scenario, first_mes, mes_example, creator_notes, system_prompt, post_history_instructions, alternate_greetings, tags, creator, character_version, extensions).
- Catchalls (`[string]: "unknown"`) on `CharacterCardV2` and `CharacterDataV2` allow extra top-level fields and extra data fields without rejecting the card.
- `character_book` is optional. If present, must match `CharacterBook` schema. If absent, the field is just not in the row.
- `extensions` is required (must be an object), but other extension fields are optional.

What **fails** import:
- Non-PNG files (parse error)
- PNGs without a `chara` tEXt chunk
- V3-only cards (only `ccv3`, no `chara`)
- V2 cards missing required fields
- V2 cards with wrong `spec`/`spec_version`

What **passes** import (no manual cleanup needed):
- V2 cards with extra top-level fields (`create_date`, `chat`, `creatorcomment`)
- V2 cards with extra `data` fields
- V2 cards with `character_book` (the embedded book is preserved verbatim in the JSON; not extracted as a standalone lorebook on import — that only happens via the migration script)

### Server fn strictness (output)

`getCharacter` and `updateCharacter` are declared with `strict: { output: false }`. Reason: `Character.data` contains `Record<string, unknown>` (from `CharacterBook.extensions` and `CharacterExtensions`), which the framework's `ValidateSerializable` check rejects as not statically provable to serialize. The runtime data IS JSON-serializable; the strict check is just conservative. We opt out for these two fns only; `listCharacters` returns a slimmed `CharacterListItem` that excludes `data`, and `importCharacter` returns a `Pick<>`, so those are fine.

### Server fn validator wrappers

arktype validators return `ArkErrors | InferredType`, and the framework can't statically serialize the `ArkErrors` branch. The server fns wrap arktype in plain `(data: unknown) => CleanType` functions and rethrow on error:

```ts
const ImportInput = type({ pngBase64: "string > 0" });

function validateImportInput(data: unknown): { pngBase64: string } {
  const result = ImportInput(data);
  if (result instanceof type.errors) throw new Error("Invalid import input");
  return result;
}

export const importCharacter = createServerFn({ method: "POST" })
  .validator(validateImportInput)
  .handler(async ({ data }) => { /* ... */ });
```

### Edge cases handled

1. **Corrupt PNG** — `png-chunks-extract` throws → caught, returned as `invalid_png`.
2. **No `chara` tEXt chunk** — `readCharacterCard` throws "No PNG metadata." → `invalid_png`.
3. **V3-only PNG** (only `ccv3`) — same as #2 since parser ignores `ccv3`.
4. **Base64 decode fails** — `Buffer.from` returns garbage or throws → `invalid_png`.
5. **Invalid V2 card (missing fields)** — arktype rejects → `validation` error with field-level messages.
6. **Disk write fails (permission, full disk)** — caught, returned as `save_failed`. No DB row created.
7. **DB insert fails (FK violation, etc.)** — exception thrown; the wrapper catches it, deletes the just-written avatar file (`rm(imagePath)`), then re-throws. No orphan files.
8. **Unauthenticated user** — `getSession()` throws "Unauthorized". Server fn throws. TanStack Query exposes via `mutation.isError`.
9. **Duplicate imports (same PNG twice)** — both succeed, two separate rows with two separate UUIDs. No dedup. (Same as SillyTavern behavior.)
10. **Avatar access by another user** — API route calls `getCharacter(userId, id)` which throws "Character not found" if id isn't owned by the user. → 404. (Doesn't leak existence.)
11. **Character has no avatar (`imagePath` is null)** — API route returns 404 instead of crashing.
12. **Avatar file missing on disk** — `readFile` rejects ENOENT → API route returns 404.
13. **Delete character → avatar cleanup** — server fn fetches `imagePath` first, then deletes the row, then `fs.rm(imagePath)` with `try/catch ENOENT` (best-effort).
14. **Delete cascades** — `chats.character_id` has `ON DELETE CASCADE` in the schema, so deleting a character removes its chats and messages. Destructive + irreversible; UI should add a confirm step before the button is wired (out of scope this pass).

### What the avatar API route looks like in practice

```ts
// In a route component
<img src={`/api/characters/${character.id}/avatar`} alt={character.name} />
```

The browser sends cookies; the route calls `getSession()` to verify auth and `getCharacter(userId, id)` to verify ownership. `cache-control: private, max-age=300` is set so the browser caches per-session.

---

## Legacy migration (`scripts/migrate-data.ts`)

### What it does

Reads `public/data/` and inserts into `dev.db`:
- `characters/*.png` → `characters` rows (PNG copied to `data/avatars/<uuid>.png`)
- `worlds/*.json` → `lorebooks` + `lore_entries` rows
- `data.character_book` on each new character → extracted as a standalone `<char.name> [embedded]` lorebook (also stored verbatim in `characters.data`)
- `settings.json` → `power_user.personas` + `persona_descriptions` → `personas` rows (icons copied from `User Avatars/` or `thumbnails/persona/` to `data/personas/<uuid>.png`)

**Not migrated:** presets, chats, the rest of `settings.json`.

### Run

```bash
nub run migrate
```

Idempotent — re-runs skip by `(userId, name)`. Safe to run after partial failure.

### How it differs from the app import path

| | App import | Migration |
|---|---|---|
| User | authenticated via `getSession()` | hardcoded `DEFAULT_USER_ID = "default-user"` |
| Validation | strict `validateCharacterCard` | `normalizeCardData(raw)` then `validateCharacterCard` |
| Input | base64 string | file on disk |
| Output | return result to client | log progress to stdout |
| Idempotency | not idempotent (every call inserts) | dedup by name |
| Throws on auth | yes (throws Unauthorized) | creates the user if missing |
| Multiple cards of same name | inserts (one row per upload) | skips (one row per name) |

### Card normalization (the key difference)

`normalizeCardData()` in `scripts/migrate-data.ts` rewrites legacy ST data into a shape that passes the strict `validateCharacterCard`. Real-world SillyTavern cards routinely violate the V2 spec in benign ways. The user-facing import fn does **not** normalize — uploaded cards must already conform. The migration does, because the source data is already in our repo and we own it.

Transformations applied:
- `extensions.talkativeness` "0.5" → `0.5` (string → number, parseable)
- `extensions.talkativeness` "abc" → omitted (not parseable)
- `extensions.depth_prompt` with missing/invalid `role` → removed
- `character_book: null` → omitted from the data object
- `character_book.extensions: undefined` → `{}`
- `character_book.entries[].position: ""` (sentinel) → omitted
- `character_book.entries[].keys` empty or `content` empty → entry dropped
- `character_book.entries[].{enabled, insertion_order, secondary_keys, selective, constant}` missing → sensible defaults (true / 100 / [] / false / false)

**Not transformed (intentionally):**
- V3 cards. The parser doesn't read `ccv3` chunks. The V2 `chara` chunk is missing → parser throws "No PNG metadata" → migration logs and skips. Four cards in the current dataset (Kyane, Naomi, Rachel, "Kyomi, Summer with your affectionate aunt") are dropped this way. Re-enabling V3 is a deliberate change to the parser and the schema, not a normalization step.
- The original PNG bytes. The migration copies the file to `data/avatars/<uuid>.png`. The original lives on disk at `public/data/characters/...png` and is gitignored. The avatar file is the source of truth for what shows in `<img>` tags.

### V3 cards — current state

The migration script does **not** include a V3-downgrade path. V3 cards differ from V2 in that the `data` payload is `Record<string, unknown>` instead of the strict `CharacterDataV2` shape, and additional fields are at the top level. Downgrading to V2 is technically possible (V3's data object is a superset) but not yet implemented. If the user later needs to migrate V3 cards, the path is:
1. Update `parseCharacterCard` to try `chara` first, then `ccv3` (or accept either via a flag).
2. Add a `V3Data → CharacterDataV2` transform that maps V3-only fields (`assets`, `creator_notes`, `character_version`, `tags`) to V2 equivalents, dropping V3-only fields like `nickname` and `creator_notes_multilingual`.
3. Re-run the migration.

### Last run result (2026-06-24)

| Source | Count | Outcome |
|---|---|---|
| `characters/*.png` (34) | 30 inserted, 0 skipped, 4 failed | 4 failures = V3 cards (Kyane, Naomi, Rachel, "Kyomi, Summer…") |
| `worlds/*.json` (13) | 13 inserted, 134 entries |  |
| `character_book` extracted (14) | 14 inserted | One per character that has an embedded book |
| `power_user.personas` (1) | 1 inserted (Marv) | |
| `chats/*.jsonl` (3 dirs with content) | 0 migrated | User opted out |

Final DB state: 1 user, 30 characters, 27 lorebooks (13 + 14), 278 lore entries (134 standalone + 144 embedded), 1 persona.

### To re-run safely

1. `nub run migrate` — no-op if everything is already in place (idempotent).
2. If you want a clean slate, manually delete the user and dependents (FKs aren't auto-enforced in the dev sqlite by default — `ON DELETE CASCADE` clauses are in the schema but SQLite needs `PRAGMA foreign_keys = ON` per connection, which the drizzle instance here doesn't set):
   ```bash
   sqlite3 dev.db "DELETE FROM lore_entries; DELETE FROM chat_messages; DELETE FROM characters; DELETE FROM lorebooks; DELETE FROM personas; DELETE FROM user WHERE id='default-user';"
   rm -rf data/avatars/* data/personas/*
   nub run migrate
   ```
   **Note:** `lore_entries` and `chat_messages` are NOT cascaded by deleting their parents in dev, because FK enforcement is off. They must be deleted explicitly or you get orphans.

---

## File / directory map

```
src/
  routes/
    characters/
      index.tsx                # list view (cards, delete button)
      new.tsx                  # import form
    api/characters/
      $id/avatar.ts            # GET PNG bytes from data/avatars/
  server/
    fns/characters.ts          # createServerFn for list/get/import/update/delete
  hooks/
    useCharacters.ts           # TanStack Query hooks + fileToBase64 helper
  db/
    repositories/characters.ts # createCharacter, listCharacters, etc.
    __tests__/characters.repo.test.ts
scripts/
  migrate-data.ts              # legacy ST migration
data/
  avatars/<uuid>.png           # character avatars (gitignored)
  personas/<uuid>.png          # persona icons (gitignored)
public/
  data/                        # legacy ST export (gitignored)
    characters/*.png
    worlds/*.json
    chats/<Char>/*.jsonl
    User Avatars/<key>.png
    thumbnails/persona/<key>.png
    settings.json
```

---

## What's NOT in scope for this slice

- **V3 character support** — parser/serializer/validators narrowed to V2. Adding V3 back is a deliberate change, not a bug.
- **Character detail page** — list + import work, but `/characters/$id` not built. The data is all there.
- **Export character to PNG** — `writeCharacterCard` exists in st-core, but no UI/hook.
- **Edit character** — `updateCharacter` server fn exists with rename only. Full edit (description, tags, etc.) is a follow-up.
- **Preset migration or chat migration** — user opted out. Schema and st-core support them.
