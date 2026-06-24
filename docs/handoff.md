# st-v2 — Handoff

Snapshot of project state, decisions, and next steps. Agent-first: written for picking up work, not for reading end-to-end.

---

## TL;DR

- **st-core** — 7 pure-logic modules copied to `src/lib/st-core/` (shared, character, chat-tree, lorebook, context, script, transform). V2-only, do not edit.
- **DB + auth** — Drizzle schema, better-auth adapter, `dev.db` with 11 tables. `getSession()` is a single-user stub until real auth UX lands.
- **Characters slice** — repo + server fns + hooks + UI routes (list, new, detail) + 15 repo tests. V2 PNG import + rename + delete + read-only detail with embedded lorebook collapsible.
- **Lorebooks slice** — repo + server fns + hooks + UI routes (list, new, detail with entry CRUD dialog) + 36 repo tests. `listLorebooks` includes `entryCount` via leftJoin + groupBy.
- **Legacy migration** — `scripts/migrate-data.ts` imports `public/data/` (30 chars, 27 lorebooks, 1 persona). Idempotent.
- **Upload normalization** — `src/lib/character/normalize.ts` shared by `importCharacter` and the migration. Both paths normalize then strictly validate. 9 unit tests.
- **Next: Phase 3 (chats + messages)** — re-uses the chat-tree `tree.test.ts` swipe/regenerate scenario at the repo level.

---

## Project Context

TanStack Start rewrite of SillyTavern-style character chat. Single-character roleplay with branching swipes, lorebooks, and configurable generation presets.

**Repo root:** `/Users/marvinprakash/codes/st-v2/v2app`

---

## What's Built

### st-core library (`src/lib/st-core/`)

7 modules, no persistence. See AGENTS.md for the module table + server-only constraint on the `character` module.

### Database + auth (Phase 0)

- `drizzle.config.ts` → `schema: './src/db/schema.ts'`, `dialect: 'sqlite'`, `out: './drizzle'`.
- `src/db/index.ts` → `export const db = drizzle(process.env.DATABASE_URL!, { schema })`, exports `type DB` for consumers.
- `DATABASE_URL="dev.db"` in `.env.local`. `dev.db` created by `drizzle/0000_nebulous_famine.sql`.
- `src/lib/auth.ts` — `betterAuth({ database: drizzleAdapter(db, ...), emailAndPassword, plugins: [tanstackStartCookies()] })`.
- `src/lib/auth-client.ts` — `createAuthClient()`.
- API route: `src/routes/api/auth/$.ts` — proxies GET/POST to `auth.handler(request)`.
- `src/server/session.ts:14` — `getSession()` single-user stub (throws on no session in real auth).

### Schema (locked)

Auth tables (hand-written in same schema file): `user`, `session`, `account`, `verification`.

Domain tables (all user-scoped via `userId` fk):

| Table | Key columns | Status |
|---|---|---|
| `characters` | id (uuid text pk), userId fk, name, `data` text-json (`CharacterDataV2` via `$type<>`), spec, specVersion, imagePath | in use |
| `lorebooks` | id pk, userId fk, name, description, imagePath, `config` text-json (`$type<LoreConfig>()`) | in use |
| `lore_entries` | id pk, lorebookId fk, uid int, `data` text-json (`$type<LoreEntryData>()`) | in use |
| `chats` | id pk, userId fk, characterId fk, title, backgroundPath, `metadata` text-json | ⏳ Phase 3 |
| `chat_messages` | composite pk (chatId, localId int), parentLocalId, `children` (number[]), selectedChildLocalId, role, name, content, isUser, isSystem, `extra` (Record<string,unknown>) | ⏳ Phase 3 |
| `presets` | id pk, userId fk, name (unique per user), `data` text-json | ⏳ Phase 4 |
| `personas` | id pk, userId fk, name, description, iconPath | in use (read by migration) |

### Characters slice

```
src/db/
  repositories/characters.ts                 # list, get, create, update, delete (all take userId)
  __tests__/characters.repo.test.ts           # 15 tests
src/server/
  fns/characters.ts                           # list, get, import, update, delete
  session.ts                                  # getSession() stub
src/routes/
  characters/{index,new,$id}.tsx              # list, import form, detail (read-only + rename + delete)
  api/characters/$id/avatar.ts                # GET PNG bytes from data/avatars/
src/hooks/useCharacters.ts                    # TanStack Query hooks + fileToBase64
src/lib/character/normalize.ts                # shared normalizeCardData (used by import + migration)
src/lib/character/normalize.test.ts           # 9 tests
```

**V2 import flow:** client `file.arrayBuffer()` → base64 → `importCharacter` server fn → `parseCharacterCard` → `normalizeCardData` → `validateCharacterCard` (strict arktype) → write PNG to `data/avatars/<uuid>.png` → insert row. On DB failure: `rm(imagePath)` orphan cleanup.

### Lorebooks slice

```
src/db/
  repositories/lorebooks.ts                  # lorebook + entry CRUD, listLorebooks w/ entryCount via leftJoin+groupBy
  __tests__/lorebooks.repo.test.ts            # 36 tests
src/server/
  fns/lorebooks.ts                            # lorebook + entry server fns
src/routes/
  lorebooks/{index,new,$id}.tsx               # list, new, detail with entry CRUD dialog
src/hooks/useLorebooks.ts                     # TanStack Query hooks
```

`nextEntryUid(userId, lorebookId)` fetches max+1 in the create-entry path. Entry ownership enforced transitively via `getLorebook(userId, lorebookId)` at the top of every entry repo fn (entries have no `userId` column).

### Legacy migration (`scripts/migrate-data.ts`)

**Run:** `nub run migrate` (one-time; idempotent by `(userId, name)`).

Reads `public/data/` (a real SillyTavern v1.18.0 export that lives in this repo) and bulk-loads: characters + embedded books → extracted as `<char.name> [embedded]` lorebooks, standalone lorebooks (`worlds/*.json`) → lorebooks, `power_user.personas` → personas (icons copied to `data/personas/<uuid>.png`).

**Not migrated:** presets, chats. V3 cards rejected. `normalizeCardData` is applied before `validateCharacterCard` so legacy data passes the strict gate.

### app-level chat pipeline (`src/lib/chat/`)

Client-side, in-memory: `pipeline.ts`, `preset.ts`, `pre-process.ts`, `context-builder.ts`, `lorebook.ts`, `types.ts`, `sample-data.ts`. Used by the `/` (index) pipeline demo route. No persistence — real chat comes in Phase 3.

---

## Architecture Conventions (locked)

- **Layering:** route/hook → `createServerFn` (validator + auth check) → repository (drizzle) → `db`.
- **IDs:** `crypto.randomUUID()` for text-pk entities; `getNextId(tree)` for chat message localIds.
- **Timestamps:** `integer` unix ms, `createdAt`/`updatedAt`.
- **Repositories throw** on not-found / wrong-user (no silent nulls) — server fns map to 404/403.
- **Query keys:** colocated per hook file (`characterKeys`, `lorebookKeys`). Invalidation: `queryClient.invalidateQueries({ queryKey: entityKeys.all })` on success.
- **`noUnusedLocals`/`noUnusedParameters` ON** — keep imports tight, prefix unused with `_` if needed.
- **Server fn strictness:** `strict: { output: false }` on fns returning `Character` (the `Record<string, unknown>` in st-core's `CharacterBook.extensions` and `CharacterExtensions` isn't statically serializable).
- **Server fn validators:** plain `(data: unknown) => CleanType` wrappers around arktype — `ArkErrors` union doesn't satisfy `ValidateSerializable`. Wrappers rethrow on error.
- **Avatar/persona icons on disk** at `data/avatars/<uuid>.png` and `data/personas/<uuid>.png`, served by API routes. Sibling dirs. Gitignored.
- **`$type<>` for known JSON shapes** — `characters.data` (`CharacterDataV2`), `lorebooks.config` (`LoreConfig`), `lore_entries.data` (`LoreEntryData`). Avoids `unknown` end-to-end.

---

## Locked Decisions (that constrain future work)

| Decision | Choice | Why |
|---|---|---|
| V3 character support | **Removed** | V2 only. Parser reads only `chara` tEXt chunk; types/schema narrow to V2. |
| Big payloads | `text({ mode: 'json' })` columns | Pragmatic over 30+ columns; round-trips typed via drizzle + `$type<>`. |
| Chat messages | One row per message (relational) | Enables message-level CRUD; chat-tree lib round-trips via `treeFromNodes`/`treeToNodes`. |
| Lore entries | Separate table | Enables per-entry CRUD; entry ownership enforced transitively. |
| Avatar storage | Disk at `data/avatars/<uuid>.png` | Avoids schema migration + blob column. |
| Migration user | Hardcoded `DEFAULT_USER_ID = "default-user"` | Single-user app for now; migration creates the row if missing. |
| Migration idempotency | Skip existing by `(userId, name)` | Re-runnable after partial failure. |
| Migration card handling | `normalizeCardData` then `validateCharacterCard` | Both upload + migration paths share the same leniency. |
| Migration: V3 / presets / chats | Rejected / not migrated / not migrated | V2-only, user opted out of preset+chat migration. |
| Chat tree semantics | Use st-core as-is, no auto-select on `addSibling` | This is the SillyTavern swipe/regenerate pattern; caller must `selectChild` after. |

---

## Known Issues

- **FK enforcement off in dev.db** — `drizzle.config.ts` + `src/db/index.ts` do not set `PRAGMA foreign_keys = ON` per connection. `ON DELETE CASCADE` clauses are in the schema and would take effect on any client that enables enforcement, but in dev they don't. Workaround: manual wipes must also delete `lore_entries` and `chat_messages` explicitly.
- **Typecheck noise** — 2 pre-existing errors (drizzle.config.ts:6 `string | undefined` for `DATABASE_URL`; st-core/transform/regex.ts:161 `noUnusedLocals`). Do not fix unless asked. See AGENTS.md.

---

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | DB schema + drizzleAdapter + `getSession()` + migrations | ✅ Done |
| 1 | Characters: repo + server fns + hooks + UI + repo test | ✅ Done |
| 2 | Lorebooks + entries: same shape | ✅ Done |
| migration | `scripts/migrate-data.ts` for legacy `public/data/` | ✅ Done |
| character detail | `/characters/$id` two-column read-only + rename + delete + collapsible embedded lorebook | ✅ Done |
| upload validation | Share `normalizeCardData` between migration + `importCharacter` | ✅ Done |
| **3** | Chats + messages: repo + server fns + hooks + UI + repo test (re-uses chat-tree swipe/regenerate scenario) | ⏳ **Next** |
| 4 | Presets: same shape (user opted out of preset migration; CRUD for future user-created presets) | ⏳ |
| 5 | Personas: same shape (migration already populates; needs CRUD UI) | ⏳ |
| 6 | Cross-cutting: `nub run test` + `npx tsc --noEmit` + lint sweep + user-isolation tests across all repos + fix FK enforcement | ⏳ |

---

## How to Pick This Up

1. Read `AGENTS.md` (conventions + commands + known typecheck noise).
2. Read this file for state + decisions + roadmap.
3. Run `nub run test` — expect **135/135** green (75 chat-tree + 9 normalize + 15 characters repo + 36 lorebooks repo).
4. Run `npx tsc --noEmit` — expect 2 pre-existing errors only.
5. Run `nub run migrate` — expect 30 chars, 27 lorebooks, 1 persona (re-runs are no-ops via dedup).
6. Start **Phase 3 (chats)** — mirror the characters / lorebooks pattern. Re-use the chat-tree `tree.test.ts` swipe/regenerate integration scenario at the repo level.
