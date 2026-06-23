# st-v2 — Handoff

Snapshot of project state, decisions, and next steps. Last updated: 2026-06-23.

---

## TL;DR

- **st-core copied to `src/lib/st-core/`** — 7 pure-logic modules extracted from SillyTavern: `shared`, `character`, `chat-tree`, `lorebook`, `context`, `script`, `transform`. Untouched by app code so far.
- **chat-tree logic verified** — 75 vitest tests covering every exported function in `tree.ts` and `tree-io.ts`, plus a swipe/regenerate integration scenario with `validateTree` asserted after every mutation.
- **Drizzle + better-sqlite3 wired but empty** — `drizzle.config.ts`, `src/db/index.ts` exist; `src/db/schema.ts` does not. `dev.db` not yet created. `db` is imported nowhere.
- **Better-auth wired but not persisting** — `src/lib/auth.ts` has no `database` config. Needs drizzle adapter wired in `auth.ts` and tables added to schema.
- **No CRUD yet** — server fns, repositories, hooks, and `src/serverActions/` are all absent. UI is a single client-side pipeline demo on `/` using in-memory sample data.
- **Roadmap locked** — 6-phase plan to build user-scoped CRUD for Characters, Chats+messages, Lorebooks, Presets, Personas. **Phase 0** is the only phase approved for execution next (schema + auth DB wiring + migrations).

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
  character/               # V1/V2/V3 character cards, PNG read/write, validators (server-only: Buffer)
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

### Drizzle scaffolding (incomplete)

- `drizzle.config.ts` → `schema: './src/db/schema.ts'`, `dialect: 'sqlite'`, `out: './drizzle'`.
- `src/db/index.ts` → `export const db = drizzle(process.env.DATABASE_URL!)`.
- `DATABASE_URL="dev.db"` in `.env.local`.
- `dev.db` does not exist. `drizzle/` migrations folder does not exist. `db` is imported nowhere.

### Better-auth scaffolding (incomplete)

- `src/lib/auth.ts` — `betterAuth({ emailAndPassword: { enabled: true }, plugins: [tanstackStartCookies()] })`. **No `database` config** — auth is not persisting yet.
- `src/lib/auth-client.ts` — `createAuthClient()`.
- API route: `src/routes/api/auth/$.ts` — proxies GET/POST to `auth.handler(request)`.
- Better-auth will create its own tables (`user`, `session`, `account`, `verification`) in the same SQLite db once the adapter is wired.

### Existing app surface

- `src/routes/__root.tsx` — root with Header + TanStack providers.
- `src/routes/index.tsx` — **client-side pipeline demo** (no DB, no API calls). Uses in-memory `SAMPLE_CHARACTER` + `SAMPLE_CHAT_HISTORY` from `src/lib/chat/sample-data.ts` and `runPipeline` from `src/lib/chat/pipeline.ts`. 9-step preprocessing visualization.
- `src/lib/chat/` — pipeline, preset, pre-process, context-builder, lorebook, types, sample-data. App-level logic, no persistence.
- `src/components/Header.tsx` — minimal nav (Home link only).
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
| Lint | `nubx oxlint src/` |
| Format | `nubx oxfmt src/` |
| Typecheck | `npx tsc --noEmit` |
| Generate drizzle migration | `nub run db:generate` |
| Apply drizzle migration | `nub run db:migrate` |
| Drizzle studio | `nub run db:studio` |

**Watch dev:** `nub watch src/server.ts` (not used here; standard `nub run dev` is the path).

---

## Architecture (planned for CRUD layers)

```
src/db/
  schema.ts                 # all drizzle table defs (auth + 5 domain entities)
  index.ts                  # existing db instance (unchanged)
  repositories/
    characters.ts           # thin drizzle query fns, all take userId
    lorebooks.ts
    chats.ts                # includes message-tree ops (plugs into chat-tree lib)
    presets.ts
    personas.ts
  __tests__/
    helpers.ts              # in-memory :memory: db + schema builder
    characters.repo.test.ts # (and one per entity)
src/server/
  session.ts                # getSession() helper — reads cookie, returns {user, session} or throws
  fns/
    characters.ts           # createServerFn GET/POST: list/get/create/update/delete
    lorebooks.ts
    chats.ts
    presets.ts
    personas.ts
src/hooks/
  useCharacters.ts          # useCharacters, useCharacter, useCreateCharacter, ...
  useLorebooks.ts
  useChats.ts
  usePresets.ts
  usePersonas.ts
```

**Layering:** route/hook → `createServerFn` (validator + auth check) → repository (drizzle) → `db`. UI routes are **out of scope** this pass.

**Conventions:**
- IDs: `crypto.randomUUID()` for text-pk entities; `getNextId(tree)` for chat message localIds.
- Timestamps: `integer` unix ms, `createdAt`/`updatedAt`.
- Repositories throw on not-found / wrong-user (no silent nulls) — server fns map to 404/403.
- Query keys: `['characters']`, `['characters', id]`, `['chats', chatId, 'tree']`, etc. Invalidation helpers colocated per hook file.
- `noUnusedLocals`/`noUnusedParameters` are ON — keep imports tight, prefix unused with `_` if needed.

---

## Schema (locked, Phase 0)

**Auth tables** (hand-written to keep one schema file):
- `user` (id text pk, name, email unique, emailVerified int, image, createdAt, updatedAt)
- `session` (id pk, token unique, expiresAt, userId fk, ipAddress, userAgent, createdAt, updatedAt)
- `account` (id pk, accountId, providerId, userId fk, access/refresh/idToken, expiry fields, scope, password, createdAt, updatedAt)
- `verification` (id pk, identifier, value, expiresAt, createdAt, updatedAt)

**Domain tables (all user-scoped via `userId` fk):**

| Table | Key columns | Notes |
|---|---|---|
| `characters` | id (uuid text pk), userId fk, name, `data` text-json (full `CharacterDataV2`), spec, specVersion, avatar blob nullable, createdAt, updatedAt | name as real column for list/search; V2 payload in JSON. Avatar/PNG bytes deferred. |
| `lorebooks` | id pk, userId fk, name, description, `config` text-json (`LoreConfig`), createdAt, updatedAt | standalone; character-embedded books live inside `characters.data` |
| `lore_entries` | id pk, lorebookId fk, uid int (per-book), `data` text-json (full `LoreEntry`), index on lorebookId | separate table → per-entry CRUD without rewriting array |
| `chats` | id pk, userId fk, characterId fk, title, `metadata` text-json (`ChatMetadata`), createdAt, updatedAt | belongs to character |
| `chat_messages` | composite pk (chatId, localId int), parentLocalId int nullable, `children` text-json (number[]), selectedChildLocalId int nullable, role, name, content, isUser int, isSystem int, `extra` text-json | one row per message; columns mirror `ChatMessage` → `treeFromNodes(rows)`/`treeToNodes(tree)` round-trip |
| `presets` | id pk, userId fk, name (unique per user), `data` text-json (full `ChatCompletionPreset`), createdAt, updatedAt | name as real column for listing |
| `personas` | id pk, userId fk, name, description, icon nullable, createdAt, updatedAt | simple |

**Pinned defaults (reversible):**
- Big nested payloads stored as `text({ mode: 'json' })` columns, not flattened. Name/title pulled out as real columns.
- `chat_messages` one-row-per-message (relational), not a JSON blob in `chats`.
- `lore_entries` separate table, not a JSON array in `lorebooks`.

---

## Roadmap (CRUD pass)

User-scoped CRUD for **Characters, Chats+messages, Lorebooks, Presets, Personas** via **Drizzle/SQLite** + **`createServerFn`** server fns + **TanStack Query hooks**. No UI routes in this pass.

| Phase | Scope | Depends on |
|---|---|---|
| **0** | `src/db/schema.ts` · wire `drizzleAdapter` in `auth.ts` · `src/server/session.ts` `getSession()` · generate + run migrations | — |
| 1 | Characters: repo + server fns + hooks + repo test | 0 |
| 2 | Lorebooks + entries: repo + server fns + hooks + repo test | 0 |
| 3 | Chats + messages: repo + server fns + hooks + repo test (re-uses chat-tree integration scenario) | 1 |
| 4 | Presets: repo + server fns + hooks + repo test | 0 |
| 5 | Personas: repo + server fns + hooks + repo test | 0 |
| 6 | Cross-cutting: `nub run test`, `npx tsc --noEmit`, lint, format, user-isolation tests | 1–5 |

**Phase 0 is the only phase approved for execution next.** After it lands, pause for review.

---

## Decisions Log

| Decision | Choice | Why |
|---|---|---|
| Storage | Drizzle / SQLite | Already wired (config + db instance + DATABASE_URL); relational fit for chat trees; auth-friendly. |
| Scope | Data layer + server fns + hooks (no UI) | User requested "CRUD functions"; routes deferred. |
| Auth scoping | User-scoped (`userId` fk on every domain table) | Better-auth is multi-user; matches setup. |
| Entities | Characters, Chats+messages, Lorebooks, Presets, Personas | All 5 selected by user. |
| Big payloads | `text({ mode: 'json' })` columns | Pragmatic over 30+ columns; round-trips typed via drizzle. |
| Chat messages | One row per message (relational) | Enables message-level CRUD; chat-tree lib round-trips via `treeFromNodes`/`treeToNodes`. |
| Lore entries | Separate table | Enables per-entry CRUD. |
| Test framework | vitest (already installed, no config needed) | Default include picks up colocated `*.test.ts`; `vite.config.ts` works as-is. |
| Test fixtures | Hand-built `makeNode()`, no arktype coupling | Keeps tests self-contained. |
| Logger capture in tests | `setLogger()` from `@/lib/st-core/shared` | Deterministic, no console spying. |
| Phase gating | Phase 0 only, then pause | User requested review checkpoint before more code. |
| Top-level `st-core` barrel | Not expanded in this pass | Reachable via deep imports; expansion is optional follow-up. |

---

## Known Issues / Typecheck Noise

Per `AGENTS.md`, these are **pre-existing and expected** — do not fix unless asked:

- `src/lib/st-core/transform/regex.ts:161` — `'params' is declared but its value is never read` (`noUnusedLocals`).
- `drizzle.config.ts(6,29)` — pre-existing type error in drizzle config (DB url typed as `string` not `string | undefined`). Surfaced by `npx tsc --noEmit`.

Pre-existing app errors in demo routes (`routeTree.gen.ts` missing, `#/components/ui/*` missing) are unrelated to st-core.

---

## Deferred / Out of Scope

- **PNG avatar import/export** for characters — `character/png-encode.ts` is server-only (Buffer). Store avatar as `blob` column (planned) but encode/decode workflows are a separate sub-task.
- **Character-embedded lorebook syncing** — character cards may carry a `character_book`. For now, treat the embedded one as opaque data inside `characters.data`. Standalone lorebooks are their own entity.
- **UI routes** for character/chat/lorebook/preset/persona CRUD — deferred per user choice.
- **Prompt-manager / PromptSection persistence** — the `context` module has a `PromptCollection`; not in the 5-entity scope.
- **Top-level `st-core` barrel expansion** — `index.ts` still only re-exports `shared/`.
- **Persona↔chat binding** — the sample data has a `persona` field on the character; no persona-on-chat association yet.

---

## File Reference Index

### st-core (copied library, do not edit)
- `src/lib/st-core/index.ts` — top-level barrel (re-exports `shared/` only)
- `src/lib/st-core/shared/{types,validators,logger,tokens,events,idgen,index}.ts`
- `src/lib/st-core/character/{types,parser,serializer,png-encode,validator,validators,index}.ts`
- `src/lib/st-core/chat-tree/{types,tree,tree-io,index}.ts`
- `src/lib/st-core/lorebook/{types,buffer,context-builder,validators,index}.ts`
- `src/lib/st-core/context/{types,collection,story-string,examples,assembler,validators,index}.ts`
- `src/lib/st-core/script/{types,scope,parser,runtime,index}.ts`
- `src/lib/st-core/transform/{macros,regex,index}.ts`

### Tests
- `src/lib/st-core/chat-tree/tree.test.ts` — **75/75 passing**

### App (existing)
- `src/routes/__root.tsx` — root route with providers
- `src/routes/index.tsx` — pipeline demo (client-side, in-memory)
- `src/routes/api/auth/$.ts` — better-auth API route
- `src/components/Header.tsx` — minimal nav
- `src/lib/auth.ts` — better-auth instance (needs `database` config)
- `src/lib/auth-client.ts` — `createAuthClient()`
- `src/lib/chat/{pipeline,preset,pre-process,context-builder,lorebook,types,sample-data}.ts`
- `src/lib/utils.ts` — `cn()` helper
- `src/integrations/tanstack-query/{root-provider,devtools}.tsx`
- `src/db/index.ts` — drizzle instance (no consumers yet)
- `drizzle.config.ts` — drizzle-kit config

### Config / meta
- `package.json` — scripts: `dev`, `test`, `build`, `db:generate/migrate/push/pull/studio`, `lint`, `format`
- `tsconfig.json` — bundler mode, `@/*` + `#/*` paths, strict, `noUnusedLocals`/`noUnusedParameters` ON
- `vite.config.ts` — `resolve.tsconfigPaths: true`, tanstack-start + react + tailwind plugins
- `.env.local` — `ANTHROPIC_API_KEY`, `DATABASE_URL="dev.db"`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`
- `AGENTS.md` — long-form agent instructions (read this first)
- `README.md` — basic

---

## How to Pick This Up

1. Read `AGENTS.md` for conventions.
2. Skim this file.
3. Run `nub run test` — expect 75/75 green.
4. Run `npx tsc --noEmit` — expect 2 pre-existing errors only (drizzle config + transform/regex:161).
5. To continue the roadmap, execute **Phase 0** (schema + auth DB wiring + `getSession()` + migrations), then pause for review.
6. Before writing any Phase 1+ code, re-confirm pinned schema defaults with the user (they're reversible but changing mid-stream means migration rework).
