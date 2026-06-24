# st-v2 — Current State

Snapshot of what exists in the repo right now. Not a roadmap, not a plan.

---

## TL;DR

- **st-core** — 7 pure-logic modules in `src/lib/st-core/`. V2-only, do not edit.
- **DB + auth** — Drizzle schema, better-auth adapter, `dev.db` with 11 tables. `getSession()` is a single-user stub until real auth UX lands.
- **Characters slice** — repo + server fns + hooks + UI routes + 15 repo tests. V2 PNG import + rename + delete + read-only detail with embedded lorebook collapsible.
- **Lorebooks slice** — repo + server fns + hooks + UI routes + 36 repo tests. `listLorebooks` includes `entryCount` via leftJoin + groupBy.
- **Chats slice** — repo + server fns + hooks + UI routes + 16 repo tests. Hidden-root tree model: all greetings pre-loaded as children of a system root; swipe-on-all, draft messages, edit, delete.
- **Tests:** 151/151 pass (75 chat-tree + 9 normalize + 15 characters + 36 lorebooks + 16 chats)
- **Typecheck:** clean (only 2 pre-existing errors: `drizzle.config.ts:6`, `transform/regex.ts:161`)
- **Legacy migration** — `scripts/migrate-data.ts` imports `public/data/` (30 chars, 27 lorebooks, 1 persona). Idempotent.
- **Upload normalization** — `src/lib/character/normalize.ts` shared by `importCharacter` and the migration. 9 unit tests.

---

## Project Context

TanStack Start rewrite of SillyTavern-style character chat. Single-character roleplay with branching swipes, lorebooks, and configurable generation presets.

**Repo root:** `/Users/marvinprakash/codes/st-v2/v2app`

---

## What's Built

### st-core library (`src/lib/st-core/`)

7 modules, no persistence. See AGENTS.md for the module table + server-only constraint on the `character` module.

### Database + auth

- `drizzle.config.ts` → `schema: './src/db/schema.ts'`, `dialect: 'sqlite'`, `out: './drizzle'`.
- `src/db/index.ts` → `export const db = drizzle(process.env.DATABASE_URL!, { schema })`, exports `type DB` for consumers.
- `DATABASE_URL="dev.db"` in `.env.local`. `dev.db` created by `drizzle/0000_*.sql` migrations.
- `src/lib/auth.ts` — `betterAuth({ database: drizzleAdapter(db, ...), emailAndPassword, plugins: [tanstackStartCookies()] })`.
- `src/lib/auth-client.ts` — `createAuthClient()`.
- API route: `src/routes/api/auth/$.ts` — proxies GET/POST to `auth.handler(request)`.
- `src/server/session.ts:14` — `getSession()` single-user stub (throws on no session in real auth).

### Schema

Auth tables (hand-written in same schema file): `user`, `session`, `account`, `verification`.

Domain tables (all user-scoped via `userId` fk):

| Table | Key columns | Status |
|---|---|---|
| `characters` | id (uuid text pk), userId fk, name, `data` text-json (`CharacterDataV2` via `$type<>`), spec, specVersion, imagePath | in use |
| `lorebooks` | id pk, userId fk, name, description, imagePath, `config` text-json (`$type<LoreConfig>()`) | in use |
| `lore_entries` | id pk, lorebookId fk, uid int, `data` text-json (`$type<LoreEntryData>()`) | in use |
| `chats` | id pk, userId fk, characterId fk, title, backgroundPath, `metadata` text-json | in use |
| `chat_messages` | composite pk (chatId, localId int), parentLocalId, `children` (number[]), selectedChildLocalId, role, name, content, isUser, isSystem, `extra` (Record<string,unknown>) | in use |
| `presets` | id pk, userId fk, name (unique per user), `data` text-json | not built |
| `personas` | id pk, userId fk, name, description, iconPath | migration populates; no CRUD UI |

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

V2 import flow: client `file.arrayBuffer()` → base64 → `importCharacter` server fn → `parseCharacterCard` → `normalizeCardData` → `validateCharacterCard` (strict arktype) → write PNG to `data/avatars/<uuid>.png` → insert row. On DB failure: `rm(imagePath)` orphan cleanup.

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

### Chats slice

```
src/db/
  repositories/chats.ts                      # chat + message CRUD, MessagePatch is fully optional
  __tests__/chats.repo.test.ts                # 16 tests
src/server/
  fns/chats.ts                                # list, get, getChatMessages, createChat, sendMessage, swipeMessage, deleteMessageBranch, editMessage, deleteChat
src/routes/
  chats/{index,new,$id}.tsx                   # list, new (character grid), chat UI
src/hooks/useChats.ts                         # TanStack Query hooks
```

**Hidden-root tree model.** Every chat starts with a `role: "system", isSystem: true, parentLocalId: null, content: ""` row at `localId = 0`, plus every greeting (`first_mes` + each `alternate_greetings[i]`) as its children at `localId = 1..N`. `root.selectedChildLocalId = 1` (first_mes is the default). The UI filters out `role === "system"` so the root is never rendered. All other server fns reject `messageLocalId === 0`.

**Chat creation** (`createChat`): only takes `{ characterId }`. Server inserts root + all greetings in one call. No greeting selector in the UI — character click → create → navigate to `/chats/$id`.

**Swipe behavior** (`swipeMessage`): operates on an arbitrary `messageLocalId` in the active path.

- Existing next/prev sibling: `selectChild(parent, sibling)`, persist parent's `selectedChildLocalId`. Old branches stay in the tree, just not visible.
- Prev + no sibling: no-op (defensive; UI disables the left arrow at `siblingIndex === 0`).
- Next + no sibling: right arrow is never disabled; server creates a new sibling:
  - **User message** (role=user, `is_user=true`) → empty user draft, `extra: { isDraft: true }`. User types and sends to populate.
  - **Greeting** (`parent_id === 0`, role=assistant) → assistant with fixed content `"Make your own greeting!"`. User opens the existing Edit button to author the opening.
  - **Other assistant** (a non-greeting reply at the end of its sibling list) → regenerate with `pickDefaultReply(rows.length + 1)`.

**Send behavior** (`sendMessage`): server detects the active leaf. If `extra?.isDraft === true` (draft user message from swipe-right), populates the draft in place: set `content`, clear `extra`, then `addChild(reply)` under it. Otherwise: append new `userMsg` as child of active leaf, then `addChild(reply)` under the new userMsg. Uses rotating `DEFAULT_REPLIES` — no AI backend wired.

**Edit message** (`editMessage`): content-only via the optional `MessagePatch` shape. Rejects drafts server-side (UI also prevents: Edit button hidden on drafts). Persists only the `content` column; no tree structure changes.

**Delete branch** (`deleteMessageBranch`): walks the subtree, deletes those messages, persists parent's `children`/`selectedChildLocalId` (auto-re-pointed by `deleteSubtree`: right-sibling → left-sibling → null, only when the deleted node was selected).

**`getNextId(tree)` ordering rule.** Allocate a new node's id *after* `addChild`-ing any previous new node, otherwise two `getNextId(tree)` calls return the same value and the second `addChild` throws "node already exists" (`tree.ts:165-166`). The `sendMessage` normal case constructs + `addChild`s the user message before allocating the reply's id for this reason.

**UI** (`/chats/$id`): active path filtered to skip system root. Swipe arrows on **every** message (`◀ 1/N ▶`): left disabled at `siblingIndex === 0`, right always enabled. Edit button (inline `<Textarea>` with Save/Cancel, opens per-message). Delete button (per-message, `window.confirm`). Drafts render as a faint bubble with placeholder "Type your message..." and hide all controls. Input box at the bottom: Enter sends, Shift+Enter newline, auto-scroll on message changes.

### Legacy migration (`scripts/migrate-data.ts`)

**Run:** `nub run migrate` (one-time; idempotent by `(userId, name)`).

Reads `public/data/` (a real SillyTavern v1.18.0 export that lives in this repo) and bulk-loads: characters + embedded books → extracted as `<char.name> [embedded]` lorebooks, standalone lorebooks (`worlds/*.json`) → lorebooks, `power_user.personas` → personas (icons copied to `data/personas/<uuid>.png`).

Not migrated: presets, chats. V3 cards rejected. `normalizeCardData` is applied before `validateCharacterCard` so legacy data passes the strict gate.

### app-level chat pipeline (`src/lib/chat/`)

Client-side, in-memory: `pipeline.ts`, `preset.ts`, `pre-process.ts`, `context-builder.ts`, `lorebook.ts`, `types.ts`, `sample-data.ts`. Used by the `/` (index) pipeline demo route. No persistence.

---

## Architecture Conventions (locked)

- **Layering:** route/hook → `createServerFn` (validator + auth check) → repository (drizzle) → `db`.
- **IDs:** `crypto.randomUUID()` for text-pk entities; `getNextId(tree)` for chat message localIds. Always addChild a node before allocating the next id in the same operation.
- **Timestamps:** `integer` unix ms, `createdAt`/`updatedAt`.
- **Repositories throw** on not-found / wrong-user (no silent nulls) — server fns map to 404/403.
- **Query keys:** colocated per hook file (`characterKeys`, `lorebookKeys`, `chatKeys`). Invalidation: `queryClient.invalidateQueries({ queryKey: entityKeys.all })` on success.
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
| Chat tree semantics | Use st-core as-is, no auto-select on `addSibling` | This is the SillyTavern swipe/regenerate pattern; caller must `selectChild` after. |
| Hidden system root | localId 0, role=system, isSystem=true, content="" | Anchors all greetings as siblings without polluting the UI. UI filters `role === "system"`. |
| All greetings pre-loaded | `first_mes` + every `alternate_greetings[i]` as children of root on createChat | One server call sets up the full swipe space; no greeting selector in UI. |
| Draft user messages | `extra: { isDraft: true }` on user messages | Server detects on send, populates in place, then adds reply as child. UI renders as faint bubble, hides all controls. |
| Right arrow never disabled | Server always creates a new sibling at end | Regenerate (assistant), editable greeting draft (greeting at end), or user draft (user at end) — server picks based on role. |
| Left arrow disabled at first sibling | UI only — server is defensive no-op | No "create previous sibling" semantics. |
| Greeting→"Make your own greeting!" | Fixed-string assistant draft at end of greeting list | Lets the user author their own opening without typing a new full message. Uses the existing Edit button, not a draft flag. |
| `getNextId` ordering | Allocate id AFTER addChild of any prior new node | Two `getNextId` calls in a row return the same id; second `addChild` throws on collision. |
| `MessagePatch` fully optional | All fields partial: children, selectedChildLocalId, content, name, extra | Content-only edits don't need to send tree-structure fields. |
| FK enforcement off in dev.db | See Known Issues | Manual cascade in `deleteChat` / `deleteMessageBranch`. |

---

## Known Issues

- **FK enforcement off in dev.db** — `drizzle.config.ts` + `src/db/index.ts` do not set `PRAGMA foreign_keys = ON` per connection. `ON DELETE CASCADE` clauses are in the schema and would take effect on any client that enables enforcement, but in dev they don't. Workaround: manual wipes must also delete `lore_entries` and `chat_messages` explicitly.
- **Typecheck noise** — 2 pre-existing errors (drizzle.config.ts:6 `string | undefined` for `DATABASE_URL`; st-core/transform/regex.ts:161 `noUnusedLocals`). Do not fix unless asked. See AGENTS.md.
- **Chat server fns have no integration tests** — the 16 chats repo tests cover CRUD at the drizzle layer, but the `sendMessage` / `swipeMessage` / `deleteMessageBranch` tree-branching logic (`getNextId` ordering, `addChild` auto-select, `deleteSubtree` re-pointing, draft detection) is only verified by manual smoke. The chat-tree primitives are unit-tested in `src/lib/st-core/chat-tree/tree.test.ts` (75 tests) but the wiring is not.

---

## Commands

| Task | Command |
|---|---|
| Run tests | `nub run test` |
| Lint | `nubx oxlint src/` |
| Typecheck | `npx tsc --noEmit` |
| Dev server | `nub run dev` |
| Run legacy migration | `nub run migrate` |
| Drizzle studio | `nub run db:studio` |

---

## Branch State

Current work is on `phase-3-chats`, 8 commits ahead of `main` (last 8 are all phase-3 chat work: repo, server fns, hooks, routes, hidden-root refactor, defensive guards, greeting-draft assistant, manual fixes during smoke).
