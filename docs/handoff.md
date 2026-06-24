# st-v2 — Handoff

Snapshot of project state, decisions, and next steps. Last updated: 2026-06-24.

---

## TL;DR

- **st-core copied to `src/lib/st-core/`** — 7 pure-logic modules extracted from SillyTavern: `shared`, `character`, `chat-tree`, `lorebook`, `context`, `script`, `transform`.
- **chat-tree logic verified** — 75 vitest tests covering every exported function in `tree.ts` and `tree-io.ts`, plus a swipe/regenerate integration scenario.
- **Phase 0 done** — Drizzle schema, better-auth adapter wired, `dev.db` created with all 11 tables via `drizzle/0000_nebulous_famine.sql`. `getSession()` helper at `src/server/session.ts:14`.
- **Phase 1 (characters) done** — repo + server fns + hooks + UI routes + 15 repo tests. End-to-end V2 character import works: `/characters/new` → upload PNG → write to DB + `data/avatars/`.
- **Legacy migration done** — `scripts/migrate-data.ts` imports the existing `public/data/` SillyTavern export (30 characters, 13 standalone lorebooks, 14 embedded books → 27 total, 278 entries, 1 persona). Re-runnable, idempotent.
- **Roadmap** — Next is **Phase 2 (lorebooks UI)**, then **Phase 3 (chats)**, then **Phase 4 (presets)**, then **Phase 5 (personas)**.

See `docs/character-import.md` for the V2 import + migration writeup.

---

## Project Context

`st-v2` is a TanStack Start app — a rewrite target for SillyTavern-style character chat. Single-character roleplay with branching swipes, lorebooks, and configurable generation presets.

**Stack:**
- TanStack Start (router + start), TanStack Query
- React 19, Vite 8, TypeScript 6
- Drizzle ORM + better-sqlite3 (SQLite, file `dev.db`)
- better-auth (email+password, tanstack-start cookies plugin)
- `@tanstack/ai*` packages (Anthropic/OpenAI/Gemini/Ollama adapters)
- arktype (runtime validators in st-core)
- pnpm 11.8, NubJS toolchain

**Repo root:** `/Users/marvinprakash/codes/st-v2/v2app`
**`AGENTS.md` at root** — long-form agent conventions (NubJS, TanStack Start, st-core notes, current progress, known typecheck noise). Read it first.

---

## What's Built

### st-core library (`src/lib/st-core/`)

7 modules, no persistence. Tree of barrel re-exports:

```
src/lib/st-core/
  index.ts                 # only re-exports shared/ — chat-tree etc. reachable only via deep import
  shared/                  # types, token counter, event bus, idgen, logger, validators
  character/               # V2-only character cards, PNG read/write, validators (server-only: Buffer)
  chat-tree/               # branching chat tree, tree I/O, validation
  lorebook/                # lore entry types, buffer, context builder, validators
  context/                 # prompt assembly, story string, examples, assembler
  script/                  # STscript parser, runtime, scope
  transform/               # text macro / regex utilities
```

**Server-only constraint:** the `character` module uses `Buffer.from()` (Node-only). Import only inside `createServerFn` handlers, not in client routes/components. The other 6 modules are isomorphic-safe.

**Import convention:** `@/*` is preferred over `#/*` (both map to `./src/*`). st-core internal imports use `.js` extensions (`'../shared/types.js'`) which resolve under bundler-mode tsconfig.

**Top-level barrel gap:** `src/lib/st-core/index.ts` only re-exports `shared`. To use `chat-tree`, `character`, etc. from elsewhere, import from the deep path: `@/lib/st-core/chat-tree`, `@/lib/st-core/character`, etc. Optional follow-up: expand the top-level barrel.

### chat-tree tests (`src/lib/st-core/chat-tree/tree.test.ts`)

- **75 tests, all passing** (`nub run test`).
- Colocated with source, picked up by vitest's default `include`.
- Imports via the **public barrel** `@/lib/st-core/chat-tree` (validates `index.ts` re-exports).
- Logger warnings captured via `setLogger()` from `@/lib/st-core/shared` (no `console` spying).
- Hand-built `makeNode()` helper; no arktype coupling.
- Coverage:
  - Every op in `tree.ts`: `createTree`, `getRootId`, `getNextId`, `getNode`, `getActivePath`, `getActiveLeafId`, `getNext/PrevSiblingId`, `getSiblings`, `addChild` (auto-select pinned), `addSibling` (no-auto-select pinned), `selectChild`, `deleteSubtree` (selection rewiring), `replaceNode`.
  - Every op in `tree-io.ts`: `treeFromNodes` (with children-clone immutability), `treeToNodes`, `treeToActivePath`, `validateTree` (all 6 error branches + cycle detection + unreachable warning).
  - Integration "swipe" workflow: regenerate → `selectChild` switch → nested child → `getActivePath`/`treeToActivePath` reflect selection → `deleteSubtree` of a sibling → `treeFromNodes`/`treeToNodes` round-trip; `validateTree` asserted `valid: true` after every step.
- **Pinned behavioral gotchas** (worth knowing in app code):
  - `addChild` auto-selects the new child (sets `parent.selected_child_id = newChild`).
  - `addSibling` does **not** auto-select — caller must `selectChild` afterward. This is the SillyTavern "swipe/regenerate" pattern but easy to forget.
  - `addChild`/`addSibling` mutate the passed `node` object (set `parent_id`, reset `children`/`selected_child_id`) — by design, the node becomes tree-owned.

### Database (Phase 0 complete)

- `drizzle.config.ts` → `schema: './src/db/schema.ts'`, `dialect: 'sqlite'`, `out: './drizzle'`.
- `src/db/index.ts` → `export const db = drizzle(process.env.DATABASE_URL!, { schema })`, exports `type DB` for consumers.
- `DATABASE_URL="dev.db"` in `.env.local`.
- `dev.db` exists with all 11 tables created by `drizzle/0000_nebulous_famine.sql`.
- Schema at `src/db/schema.ts` includes:
  - Auth: `user`, `session`, `account`, `verification`
  - Domain: `characters`, `lorebooks`, `lore_entries`, `chats`, `chat_messages`, `presets`, `personas`
  - `characters.data` typed as `CharacterDataV2` via `$type<>()` so the column is not `unknown` end-to-end.

### Better-auth (Phase 0 complete)

- `src/lib/auth.ts` — `betterAuth({ database: drizzleAdapter(db, ...), emailAndPassword, plugins: [tanstackStartCookies()] })`.
- `src/lib/auth-client.ts` — `createAuthClient()`.
- API route: `src/routes/api/auth/$.ts` — proxies GET/POST to `auth.handler(request)`.
- Auth tables live in the same `dev.db` and are managed by the better-auth drizzle adapter.

### Characters slice (Phase 1 complete)

**Architecture (in place):**

```
src/db/
  schema.ts
  index.ts (DB type export)
  repositories/
    characters.ts                 # listCharacters, getCharacter, createCharacter, updateCharacter, deleteCharacter
  __tests__/
    helpers.ts                    # makeTestDb() — in-memory :memory: SQLite + migrator
    character-data.ts             # makeCharacterData() fixture
    characters.repo.test.ts       # 15 tests covering create/get/list/update/delete + wrong-user throws
src/server/
  session.ts                      # getSession() — throws Unauthorized if no session
  fns/
    characters.ts                 # createServerFn list/get/import/update/delete
src/routes/
  api/characters/$id/avatar.ts    # GET handler streams PNG bytes from data/avatars/
  characters/index.tsx            # list view with delete buttons
  characters/new.tsx              # import form (file input → base64 → server fn)
src/hooks/
  useCharacters.ts                # TanStack Query hooks: list, detail, import, update, delete + fileToBase64
```

**Layering:** route/hook → `createServerFn` (validator + auth check) → repository (drizzle) → `db`. Repositories throw on not-found / wrong-user (no silent nulls) — server fns map to 404/403.

**V2 import flow:**
1. Client reads `File` via `file.arrayBuffer()` → `fileToBase64()` → base64 string.
2. `importCharacter({ data: { pngBase64 } })` server fn.
3. Server: `parseCharacterCard` → `validateCharacterCard` (arktype) → write PNG to `data/avatars/<uuid>.png` → insert `characters` row.
4. On success: `queryClient.invalidateQueries({ queryKey: ['characters'] })` in the hook.

**Validation strictness:** the user-facing `importCharacter` is strict (real `validateCharacterCard` arktype call). The migration script (see below) uses a softer normalization layer first.

**Edge cases handled (covered in `docs/character-import.md`):** corrupt PNG, no `chara` chunk, V3-only PNG, invalid V2 card, disk write failure, DB insert failure → orphan file cleanup, ENOENT on delete, duplicate imports allowed, single-user via `getSession()`.

### Legacy migration (`scripts/migrate-data.ts`)

**Run:** `nub run migrate` (= `nub scripts/migrate-data.ts`)

**Migrates from `public/data/`** (a real SillyTavern v1.18.0 export that lives in this repo):
- Characters → `characters` rows + PNGs copied to `data/avatars/<uuid>.png`
- Standalone lorebooks (`worlds/*.json`) → `lorebooks` + `lore_entries` rows
- Character-embedded `character_book` → extracted as `<char.name> [embedded]` lorebooks
- Personas (`settings.json` → `power_user.personas`) → `personas` rows + icons copied to `data/personas/<uuid>.png`

**Does NOT migrate:** presets, chats, settings beyond personas.

**Idempotent:** dedups by `(userId, name)` for characters/lorebooks/personas. Re-running on a populated DB is safe.

**Card normalization for legacy data:** real-world SillyTavern cards often violate the V2 spec in benign ways. The migration normalizes before `validateCharacterCard`:
- `extensions.talkativeness` "0.5" → `0.5` (string → number)
- `extensions.depth_prompt` with missing/invalid `role` → removed
- `character_book: null` → omitted
- `character_book.extensions: undefined` → `{}`
- `character_book.entries[].position: ""` → omitted (sentinel for "default")
- `character_book.entries[]` with empty `keys` or empty `content` → entry dropped
- `character_book.entries[].{enabled, insertion_order, secondary_keys, selective, constant}` missing → sensible defaults

V3 cards (4 in the current dataset: Kyane, Naomi, Rachel, "Kyomi, Summer with your affectionate aunt") are **rejected** — V2-only is a locked decision.

**Last run result:** 30/34 characters, 13 standalone + 14 embedded = 27 lorebooks (278 entries: 134 standalone + 144 embedded), 1 persona.

### Existing app surface

- `src/routes/__root.tsx` — root with Header + TanStack providers.
- `src/routes/index.tsx` — **client-side pipeline demo** (no DB, no API calls). Uses in-memory `SAMPLE_CHARACTER` + `SAMPLE_CHAT_HISTORY` from `src/lib/chat/sample-data.ts` and `runPipeline` from `src/lib/chat/pipeline.ts`. 9-step preprocessing visualization.
- `src/lib/chat/` — pipeline, preset, pre-process, context-builder, lorebook, types, sample-data. App-level logic, no persistence.
- `src/components/Header.tsx` — Home + Characters nav.
- `src/integrations/tanstack-query/` — root provider + devtools.
- `src/styles.css` and `src/lib/utils.ts` — tailwind v4 + shadcn-style helpers.

---

## Commands

| Task | Command |
|---|---|
| Install deps | `nub install` |
| Add runtime dep | `nub add <pkg>` |
| Add dev dep | `nub add -D <pkg>` |
| Dev server | `nub run dev` |
| **Run tests** | `nub run test` (= `vitest run`) |
| **Run migration** | `nub run migrate` |
| Lint | `nubx oxlint src/` |
| Format | `nubx oxfmt src/` |
| Typecheck | `npx tsc --noEmit` |
| Generate drizzle migration | `nub run db:generate` |
| Apply drizzle migration | `nub run db:migrate` |
| Drizzle studio | `nub run db:studio` |

**Watch dev:** `nub watch src/server.ts` (not used here; standard `nub run dev` is the path).

---

## Architecture (CRUD layers — Phase 1 pattern, not yet built for other entities)

```
src/db/
  schema.ts                 # all drizzle table defs (auth + 5 domain entities)
  index.ts                  # db instance + DB type export
  repositories/
    characters.ts           # thin drizzle query fns, all take userId ✅
    lorebooks.ts            # ⏳ Phase 2
    chats.ts                # ⏳ Phase 3 (includes message-tree ops)
    presets.ts              # ⏳ Phase 4
    personas.ts             # ⏳ Phase 5
  __tests__/
    helpers.ts              # in-memory :memory: db + schema builder ✅
    character-data.ts       # fixture factory ✅
    characters.repo.test.ts # 15 tests ✅
src/server/
  session.ts                # getSession() — throws Unauthorized ✅
  fns/
    characters.ts           # list/get/import/update/delete ✅
    lorebooks.ts            # ⏳ Phase 2
    chats.ts                # ⏳ Phase 3
    presets.ts              # ⏳ Phase 4
    personas.ts             # ⏳ Phase 5
src/hooks/
  useCharacters.ts          # TanStack Query hooks ✅
  useLorebooks.ts           # ⏳
  useChats.ts               # ⏳
  usePresets.ts             # ⏳
  usePersonas.ts            # ⏳
src/routes/
  characters/index.tsx      # list view ✅
  characters/new.tsx        # import form ✅
  api/characters/$id/avatar.ts # avatar stream ✅
```

**Layering:** route/hook → `createServerFn` (validator + auth check) → repository (drizzle) → `db`.

**Conventions (locked):**
- IDs: `crypto.randomUUID()` for text-pk entities; `getNextId(tree)` for chat message localIds.
- Timestamps: `integer` unix ms, `createdAt`/`updatedAt`.
- Repositories throw on not-found / wrong-user (no silent nulls) — server fns map to 404/403.
- Query keys: `['characters']`, `['characters', id]`, `['chats', chatId, 'tree']`, etc. Invalidation helpers colocated per hook file.
- `noUnusedLocals`/`noUnusedParameters` are ON — keep imports tight, prefix unused with `_` if needed.
- Avatar PNGs on disk at `data/avatars/<uuid>.png`, served by API route. Sibling dir `data/personas/` for persona icons.
- Server fn validators wrap arktype in plain functions (`(data: unknown) => CleanType`) so the framework's `ValidateSerializable` check passes. arktype's `ArkErrors` union doesn't serialize.

---

## Schema (locked, Phase 0)

**Auth tables** (hand-written to keep one schema file):
- `user` (id text pk, name, email unique, emailVerified int, image, createdAt, updatedAt)
- `session` (id pk, token unique, expiresAt, userId fk, ipAddress, userAgent, createdAt, updatedAt)
- `account` (id pk, accountId, providerId, userId fk, access/refresh/idToken, expiry fields, scope, password, createdAt, updatedAt)
- `verification` (id pk, identifier, value, expiresAt, createdAt, updatedAt)

**Domain tables (all user-scoped via `userId` fk):**

| Table | Key columns | Status |
|---|---|---|
| `characters` | id (uuid text pk), userId fk, name, `data` text-json (`CharacterDataV2` via `$type<>`), spec, specVersion, imagePath, createdAt, updatedAt | ✅ in use |
| `lorebooks` | id pk, userId fk, name, description, imagePath, `config` text-json (`LoreConfig`), createdAt, updatedAt | ✅ in use (read via migration) |
| `lore_entries` | id pk, lorebookId fk, uid int (per-book), `data` text-json, createdAt, updatedAt | ✅ in use |
| `chats` | id pk, userId fk, characterId fk, title, backgroundPath, `metadata` text-json, createdAt, updatedAt | ⏳ Phase 3 |
| `chat_messages` | composite pk (chatId, localId int), parentLocalId int nullable, `children` text-json (number[]), selectedChildLocalId int nullable, role, name, content, isUser int, isSystem int, `extra` text-json | ⏳ Phase 3 |
| `presets` | id pk, userId fk, name (unique per user), `data` text-json, createdAt, updatedAt | ⏳ Phase 4 (out of scope — user opted out of preset migration) |
| `personas` | id pk, userId fk, name, description, iconPath, createdAt, updatedAt | ✅ in use (read via migration) |

**Pinned defaults (reversible):**
- Big nested payloads stored as `text({ mode: 'json' })` columns, not flattened. Name/title pulled out as real columns.
- `chat_messages` one-row-per-message (relational), not a JSON blob in `chats`.
- `lore_entries` separate table, not a JSON array in `lorebooks`.
- `characters.data` typed via `$type<CharacterDataV2>()` (not `unknown`).
- Avatar PNGs live on disk, served via API route — no blob column.

---

## Roadmap

User-scoped CRUD for **Characters, Chats+messages, Lorebooks, Presets, Personas** via **Drizzle/SQLite** + **`createServerFn`** server fns + **TanStack Query hooks**.

| Phase | Scope | Status |
|---|---|---|
| **0** | `src/db/schema.ts` · wire `drizzleAdapter` in `auth.ts` · `src/server/session.ts` `getSession()` · generate + run migrations | ✅ Done |
| **1** | Characters: repo + server fns + hooks + UI routes + repo test | ✅ Done |
| **migration** | `scripts/migrate-data.ts` for legacy `public/data/` | ✅ Done |
| **2** | Lorebooks + entries: repo + server fns + hooks + repo test | ⏳ Next |
| **3** | Chats + messages: repo + server fns + hooks + repo test (re-uses chat-tree integration scenario) | ⏳ |
| **4** | Presets: repo + server fns + hooks + repo test | ⏳ (user opted out of preset migration; still want CRUD for future user-created presets) |
| **5** | Personas: repo + server fns + hooks + repo test | ⏳ |
| **6** | Cross-cutting: `nub run test`, `npx tsc --noEmit`, lint, format, user-isolation tests | ⏳ |

**Next: Phase 2 (lorebooks)** — `useLorebooks` hook + list/detail routes, build on the same pattern as characters. Character slice has only the bare CRUD; lorebooks are similar but with embedded-entries display (a lorebook's list of entries is its main content).

---

## Decisions Log

| Decision | Choice | Why |
|---|---|---|
| Storage | Drizzle / SQLite | Already wired (config + db instance + DATABASE_URL); relational fit for chat trees; auth-friendly. |
| Scope (per phase) | Data layer + server fns + hooks (+ UI when needed) | User asked for "CRUD functions" + import flow. Routes in-scope from Phase 1 onward. |
| Auth scoping | User-scoped (`userId` fk on every domain table) | Better-auth is multi-user; matches setup. |
| Entities | Characters, Chats+messages, Lorebooks, Presets, Personas | All 5 selected by user. |
| Big payloads | `text({ mode: 'json' })` columns | Pragmatic over 30+ columns; round-trips typed via drizzle. |
| Chat messages | One row per message (relational) | Enables message-level CRUD; chat-tree lib round-trips via `treeFromNodes`/`treeToNodes`. |
| Lore entries | Separate table | Enables per-entry CRUD. |
| `$type<>` for known JSON shapes | Used on `characters.data` (`CharacterDataV2`) and `chat_messages.children` (`number[]`), `chat_messages.extra` (`Record<string, unknown>`) | Avoids `unknown` end-to-end. |
| Test framework | vitest (already installed, no config needed) | Default include picks up colocated `*.test.ts`; `vite.config.ts` works as-is. |
| Test fixtures | Hand-built `makeNode()`, no arktype coupling | Keeps tests self-contained. |
| Test DB | `:memory:` SQLite + drizzle migrator on the same migration folder | Real schema, isolated per-test via `beforeEach`. |
| Logger capture in tests | `setLogger()` from `@/lib/st-core/shared` | Deterministic, no console spying. |
| Top-level `st-core` barrel | Not expanded in this pass | Reachable via deep imports; expansion is optional follow-up. |
| V3 character support | **Removed** | User decision — V2 only. `parser.ts` only reads `chara` tEXt chunk, `serializer.ts` only writes `chara`, types/schema narrow to V2. |
| V2 strictness | Catchalls (`[string]: "unknown"`) on `CharacterCardV2` and `CharacterDataV2` | Real cards from chub.ai often carry extra fields; rejecting them is too strict. |
| Avatar storage | **Disk at `data/avatars/<uuid>.png`** | Avoids schema migration + blob column. Served by API route `/api/characters/:id/avatar`. |
| Migration user model | **Hardcoded `DEFAULT_USER_ID = "default-user"`** | Single-user app for now. Migration creates the row if missing. |
| Migration idempotency | **Skip existing by `(userId, name)`** | Re-runnable after partial failure. |
| Migration card handling | **Normalize legacy data, then validate** | Real ST data is non-spec but recoverable. Strict path stays for user uploads. |
| Migration embedded books | **Extract as `<char.name> [embedded]` lorebooks** | Standalone lorebook list sees them. Accept potential dups with `worlds/<X>.json`. |
| Migration presets | **Not migrated** | User opted out. Schema still supports them for future Phase 4 CRUD. |
| Migration chats | **Not migrated** | User opted out (chats were causing 0-message issue + skipping is easier). |
| Server fn output strictness | `strict: { output: false }` on fns returning `Character` | The `Record<string, unknown>` in st-core's `CharacterBook.extensions` and `CharacterExtensions` is not statically serializable, even though the runtime data is JSON. |
| Server fn validator pattern | Plain `(data: unknown) => CleanType` wrappers around arktype | arktype's `ArkErrors` union doesn't satisfy the framework's `ValidateSerializable`. Wrappers rethrow on error. |

---

## Known Issues / Typecheck Noise

Per `AGENTS.md`, these are **pre-existing and expected** — do not fix unless asked:

- `src/lib/st-core/transform/regex.ts:161` — `'params' is declared but its value is never read` (`noUnusedLocals`).
- `drizzle.config.ts(6,29)` — pre-existing type error in drizzle config (DB url typed as `string` not `string | undefined`). Surfaced by `npx tsc --noEmit`.

**Operational gotcha — FKs are not enforced in dev.db:**

The schema declares `ON DELETE CASCADE` on `lore_entries.lorebook_id` and `chat_messages.chat_id`, but the drizzle instance in `src/db/index.ts` does not set `PRAGMA foreign_keys = ON` per connection. So deleting a lorebook or chat leaves their children as orphans in the DB. This is a SQLite-level concern; the FK declarations are correct in the schema and would take effect on any client that enables enforcement. Workaround for now: manual wipes must also delete `lore_entries` and `chat_messages` (see the "To re-run safely" section in `docs/character-import.md`).

---

## Deferred / Out of Scope

- **Character detail page / chat kickoff UI** — list + import work, but `/characters/$id` route not built. Phase 3 will need a similar "open chat" link.
- **Persona / Lorebook / Preset CRUD UI** — `useX` hooks and routes not yet built (Phases 2 / 4 / 5).
- **Chat JSONL migration** — the script tried to migrate chats but user opted out. Tamyra's chat files have messages without `id` fields (different ST export format). For future re-attempt: re-id messages sequentially, parse metadata line into `metadata` column.
- **Prompt-manager / PromptSection persistence** — the `context` module has a `PromptCollection`; not in the 5-entity scope.
- **Top-level `st-core` barrel expansion** — `index.ts` still only re-exports `shared/`.
- **Persona↔chat binding** — no `personaId` on `chats` schema yet. Sample data has a `persona` field on the character; would need a join table or FK on `chats`.

---

## File Reference Index

### Docs
- `docs/handoff.md` — this file
- `docs/character-import.md` — V2 import + migration writeup (read this for the import flow)
- `docs/pages.md` — characters UI pages developer handoff (list, import, avatar API)

### st-core (copied library, do not edit without user permission)
- `src/lib/st-core/index.ts` — top-level barrel (re-exports `shared/` only)
- `src/lib/st-core/shared/{types,validators,logger,tokens,events,idgen,index}.ts`
- `src/lib/st-core/character/{types,parser,serializer,png-encode,validator,validators,index}.ts` — V2-only
- `src/lib/st-core/chat-tree/{types,tree,tree-io,index}.ts`
- `src/lib/st-core/lorebook/{types,buffer,context-builder,validators,index}.ts`
- `src/lib/st-core/context/{types,collection,story-string,examples,assembler,validators,index}.ts`
- `src/lib/st-core/script/{types,scope,parser,runtime,index}.ts`
- `src/lib/st-core/transform/{macros,regex,index}.ts`

### Tests
- `src/lib/st-core/chat-tree/tree.test.ts` — **75/75 passing**
- `src/db/__tests__/characters.repo.test.ts` — **15/15 passing**

### App (existing)
- `src/routes/__root.tsx` — root route with providers
- `src/routes/index.tsx` — pipeline demo (client-side, in-memory)
- `src/routes/api/auth/$.ts` — better-auth API route
- `src/routes/characters/index.tsx` — character list view
- `src/routes/characters/new.tsx` — V2 import form
- `src/routes/api/characters/$id/avatar.ts` — avatar PNG stream
- `src/components/Header.tsx` — Home + Characters nav
- `src/lib/auth.ts` — better-auth instance
- `src/lib/auth-client.ts` — better-auth client
- `src/lib/chat/{pipeline,preset,pre-process,context-builder,lorebook,types,sample-data}.ts`
- `src/lib/utils.ts` — `cn()` helper
- `src/integrations/tanstack-query/{root-provider,devtools}.tsx`
- `src/db/index.ts` — drizzle instance (DB type export)
- `src/db/schema.ts` — all table defs (auth + 5 domain entities)
- `src/db/repositories/characters.ts` — character CRUD
- `src/server/session.ts` — getSession() helper
- `src/server/fns/characters.ts` — character server fns
- `src/hooks/useCharacters.ts` — character TanStack Query hooks
- `scripts/migrate-data.ts` — legacy ST data migration
- `drizzle.config.ts` — drizzle-kit config

### Data
- `data/avatars/*.png` — 30 character avatar PNGs (gitignored, written by import + migration)
- `data/personas/*.png` — 1 persona icon (gitignored, written by migration)

### Config / meta
- `package.json` — scripts: `dev`, `test`, `build`, `db:generate/migrate/push/pull/studio`, `lint`, `format`, `migrate`
- `tsconfig.json` — bundler mode, `@/*` + `#/*` paths, strict, `noUnusedLocals`/`noUnusedParameters` ON
- `vite.config.ts` — `resolve.tsconfigPaths: true`, tanstack-start + react + tailwind plugins
- `.env.local` — `ANTHROPIC_API_KEY`, `DATABASE_URL="dev.db"`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`
- `AGENTS.md` — long-form agent instructions (read this first)
- `README.md` — basic

---

## How to Pick This Up

1. Read `AGENTS.md` for conventions.
2. Read `docs/handoff.md` (this file) for state.
3. Read `docs/character-import.md` for the import + migration writeup.
4. Read `docs/pages.md` for the characters UI pages (list, import form, avatar API).
5. Run `nub run test` — expect **90/90** green (75 chat-tree + 15 characters repo).
6. Run `npx tsc --noEmit` — expect 2 pre-existing errors only (drizzle config + transform/regex:161).
7. Run `nub run migrate` — expect 30 chars, 27 lorebooks, 1 persona (re-runs are no-ops via dedup).
8. Continue with **Phase 2 (lorebooks)** — mirror the characters pattern.
