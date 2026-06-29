# st-v2 — Current State

Snapshot of what exists in the repo right now. Not a roadmap, not a plan.

---

## TL;DR

- **st-core** — 7 pure-logic modules in `src/lib/st-core/`. V2-only, do not edit.
- **DB + auth** — Drizzle schema, better-auth adapter, `dev.db` with 15 tables. `getSession()` resolves the current session via better-auth. `isAdmin(user)` checks `user.role === "admin"` for permission gates.
- **Characters slice** — repo + server fns + hooks + UI routes + 15 repo tests. V2 PNG import + rename + delete + read-only detail with embedded lorebook collapsible.
- **Lorebooks slice** — repo + server fns + hooks + UI routes + 36 repo tests. `listLorebooks` includes `entryCount` + **`enabled`** via leftJoin + groupBy. **Per-user activation overlay** (`user_lorebook_settings` + `user_lore_entry_settings`) wired into `/api/chat-generate`; inline enable Switch on `/lorebooks`, per-entry Switch on `/lorebooks/$id` with AND-disable semantics. **Import** button on `/lorebooks` opens a Dialog for SillyTavern world-info JSON files; parsed via `parseWorldFile` and inserted as a disabled lorebook.
- **Personas slice** — repo + server fns + hooks (CRUD) + reusable `PersonaDialog` + 12 repo tests. User-settings-backed active persona selection. Auto-seed on create via `updateUserDefaults({ defaultPersonaId: res.id })`.
- **Chats slice** — repo + server fns + hooks + UI routes + 16 repo tests. Hidden-root tree model: all greetings pre-loaded as children of a system root; swipe-on-all, draft messages, edit, delete, **streaming AI generation via SSE**. **Left/right side panels** (CSS grid 15/70/15 on md+): character portrait panel with streaming glow + lightbox, temporary per-chat custom image panel with upload/remove. **{{char}}/{{user}} macro substitution** on all persisted message content (createChat greetings, sendMessage, prepareStream, editMessage, finalizeStream) resolving `{{user}}` to the active persona name via `resolveUserName()`.
- **AI slice** — providers + presets + user-settings repos + server fns + hooks + UI. `/ai-playground` (provider/preset CRUD + streaming chat) and per-chat provider/model/preset in a **floating draggable settings panel** (`ChatSettingsPanel`) on `/chats/$id`.
- **Tests:** 222/222 pass (75 chat-tree + 9 normalize + 21 characters + 36 lorebooks + 16 chats + 8 userSettings + 15 userLorebookSettings + 22 world-file parser + 12 personas repository + **8 substitute-message-macros**)
- **Typecheck:** clean (only 2 pre-existing errors: `drizzle.config.ts:6`, `transform/regex.ts:161`)
- **Legacy migration** — `scripts/migrate-data.ts` imports `public/data/` (30 chars, 27 lorebooks, 1 persona). Idempotent.
- **Upload normalization** — `src/lib/character/normalize.ts` shared by `importCharacter` and the migration. 9 unit tests.

---

## Project Context

TanStack Start rewrite of SillyTavern-style character chat. Single-character roleplay with branching swipes, lorebooks, configurable generation presets, and OpenAI-compatible streaming generation.

**Repo root:** `/Users/marvinprakash/codes/st-v2/v2app`

---

## What's Built

### st-core library (`src/lib/st-core/`)

7 modules, no persistence. See AGENTS.md for the module table + server-only constraint on the `character` module.

### Database + auth

- `drizzle.config.ts` → `schema: './src/db/schema.ts'`, `dialect: 'sqlite'`, `out: './drizzle'`.
- `src/db/index.ts` → `export const db = drizzle(process.env.DATABASE_URL!, { schema })`, exports `type DB` for consumers.
- `DATABASE_URL="dev.db"` in `.env.local`. `dev.db` created by `drizzle/0000_*.sql` through `0003_*.sql` migrations.
- `src/lib/auth.ts` — `betterAuth({ database: drizzleAdapter(db, ...), emailAndPassword, plugins: [username(), admin({ defaultRole: "user" }), tanstackStartCookies()] })`.
- `src/lib/auth-client.ts` — `createAuthClient()`.
- API route: `src/routes/api/auth/$.ts` — proxies GET/POST to `auth.handler(request)`.
- `src/server/session.ts` — `getSession()` resolves the current session; `isAdmin(user)` checks `user.role === "admin"` for permission gates.

### Schema

**Migrations:** `0000` (initial 11 tables), `0001` (adds `ai_providers` + `presets.provider_id`/`model`), `0002` (adds `chats.provider_id`/`preset_id`/`selected_model`), `0003` (adds `user_settings`), `0004` (adds `user_lorebook_settings` + `user_lore_entry_settings`), `0005` (adds `defaultPersonaId`, `systemPrompt`, `postHistoryInstructions`, `impersonationPrompt` to `user_settings`), `0006` (adds `backgrounds`), `0007` (adds `characters.tagline`), `0008` (removes `backgrounds.user_id`, makes `ai_providers.user_id` nullable, adds `user.username`/`display_username`), `0009` (adds `user.role`/`banned`/`ban_reason`/`ban_expires` + `session.impersonated_by` for admin plugin). 15 tables.

Auth tables (hand-written in same schema file): `user`, `session`, `account`, `verification`.

Domain tables (most user-scoped via `userId` fk; `backgrounds` and the global AI provider row are shared):

| Table | Key columns | Status |
|---|---|---|
| `characters` | id (uuid text pk), userId fk, name, `data` text-json (`CharacterDataV2` via `$type<>`), spec, specVersion, imagePath, tagline | in use |
| `lorebooks` | id pk, userId fk, name, description, imagePath, `config` text-json (`$type<LoreConfig>()`) | in use |
| `lore_entries` | id pk, lorebookId fk, uid int, `data` text-json (`$type<LoreEntryData>()`) | in use |
| `user_lorebook_settings` | composite pk (userId, lorebookId), fks cascade. **Presence = enabled (opt-in default).** | in use |
| `user_lore_entry_settings` | composite pk (userId, entryId), fks cascade. **Presence = user-disabled (AND with `data.disable`).** | in use |
| `chats` | id pk, userId fk, characterId fk, title, backgroundPath, **`providerId`**, **`presetId`**, **`selectedModel`**, `metadata` text-json | in use |
| `chat_messages` | composite pk (chatId, localId int), parentLocalId, `children` (number[]), selectedChildLocalId, role, name, content, isUser, isSystem, `extra` (Record<string,unknown>) | in use |
| `presets` | id pk, userId fk, name (unique per user), **`providerId` fk (nullable)**, **`model`**, `data` text-json (`PresetData`: systemPrompt/temperature/maxTokens/topP/contextSize/frequencyPenalty/presencePenalty) | in use |
| `personas` | id pk, userId fk, name, description, iconPath | CRUD UI in ChatSettingsPanel + 12 repo tests |
| `ai_providers` | id pk, **userId fk (nullable)**, **name (unique per user)**, **baseUrl, apiKey** (encrypted), defaultModel, defaultHeaders (Record<string,string>) | in use — null userId = shared global provider |
| `user_settings` | userId pk, **defaultProviderId, defaultPresetId, defaultSelectedModel, defaultPersonaId, systemPrompt, postHistoryInstructions, impersonationPrompt** (all nullable) | in use |
| `backgrounds` | id pk, name, path, createdAt | shared (no userId — app-wide) |

`$type<>` for known JSON shapes — `characters.data` (`CharacterDataV2`), `lorebooks.config` (`LoreConfig`), `lore_entries.data` (`LoreEntryData`). `presets.data` is the db-shape subset of the full `ChatCompletionPreset`; the server pipeline merges it on top of `DEFAULT_PRESET` at request time (see `lib/chat/server-context.ts`).

### Characters slice

```
src/db/
  repositories/characters.ts                 # list, get, create, update, delete (all take userId)
  __tests__/characters.repo.test.ts           # 21 tests
src/server/
  fns/characters.ts                           # list, get, import, update, delete; demo-restricted mutations
  session.ts                                  # getSession() + isAdmin()
src/routes/
  characters/{index,new,$id}.tsx              # list, import form, detail (read-only + rename + delete)
  api/characters/$id/avatar.ts                # GET PNG bytes from data/avatars/
src/hooks/useCharacters.ts                    # TanStack Query hooks + fileToBase64
src/lib/character/normalize.ts                # shared normalizeCardData (used by import + migration)
src/lib/character/normalize.test.ts           # 9 tests
```

V2 import flow: client `file.arrayBuffer()` → base64 → `importCharacter` server fn → `parseCharacterCard` → `normalizeCardData` → `validateCharacterCard` (strict arktype) → write PNG to `data/avatars/<uuid>.png` → insert row. On DB failure: `rm(imagePath)` orphan cleanup.

**Demo restrictions:** All mutation server fns (`importCharacter`, `updateCharacter`, `updateCharacterData`, `deleteCharacter`) check `isAdmin(user)` and either return an error or throw. The UI hides import/edit/rename/delete buttons for non-admin users (components `CharacterCard`, `CharacterActions` pass an `isDemo` prop). Demo users are seeded with 2 rich characters on account creation and on server boot (if missing). See `src/server/seed.ts`.

### Lorebooks slice

```
src/db/
  repositories/lorebooks.ts                  # lorebook + entry CRUD; listLorebooks joins entryCount + enabled; listEntries joins userDisabled; deleteLorebook/DeleteEntry cascade overlay rows
  repositories/userLorebookSettings.ts        # opt-in enabled overlay + AND-disable entry overlay (presence = state, no boolean col)
  __tests__/lorebooks.repo.test.ts            # 36 tests
  __tests__/userLorebookSettings.repo.test.ts # 15 tests
src/lib/lorebook/
  world-file.ts                              # parseWorldFile: SillyTavern world-info JSON -> normalized LoreEntry[] (insertion_order->order, enabled->disable, position string->0|1, extensions flattening, key/keysecondary as string or array)
  world-file.test.ts                         # 22 tests
src/server/
  fns/lorebooks.ts                            # lorebook + entry server fns (output includes enabled/userDisabled) + importLorebook
  fns/userLorebookSettings.ts                 # setLorebookEnabled / setLoreEntryDisabled (arktype validators; ownership via getLorebook)
src/routes/
  lorebooks/{index,new,$id}.tsx               # list (enable Switch per card + Import Dialog), new, detail (per-entry Switch, author-disabled = locked off)
src/hooks/useLorebooks.ts                     # TanStack Query hooks + useToggleLorebook + useToggleLoreEntry + useImportLorebook
```

`nextEntryUid(userId, lorebookId)` fetches max+1 in the create-entry path. Entry ownership enforced transitively via `getLorebook(userId, lorebookId)` at the top of every entry repo fn (entries have no `userId` column).

**Import flow** (`importLorebook` server fn + `parseWorldFile`). `/lorebooks` index has an "Import" button (next to "New Lorebook") that opens a Dialog with a JSON file picker. The server fn takes the raw JSON string, calls `parseWorldFile` to normalize the SillyTavern world-info format to the st-core `LoreEntry` shape, creates the lorebook (disabled by default per the opt-in design), and inserts all valid entries via `repoCreateEntry`. Returns `{ id, name, entriesInserted, entriesSkipped }` so the client can report skipped entries in a toast. Non-object entries (null, arrays, primitives) are skipped and counted. The migration (`scripts/migrate-data.ts`) still uses its own raw-entry insertion path — it could be refactored to share `parseWorldFile` as a follow-up (not done here to keep the migration behavior unchanged).

**Per-user activation overlay** (`user_lorebook_settings` + `user_lore_entry_settings`). Both are presence-based join tables — no boolean column, no dead rows. **Opt-in default:** a lorebook with no `user_lorebook_settings` row is disabled for that user. An entry is active iff `!entry.data.disable && !userOverlay` (AND semantics — the author's `data.disable` still wins; per-user toggle can only further disable). The `setLorebookEnabled` / `setLoreEntryDisabled` fns verify lorebook ownership (and entry-belongs-to-lorebook for entries) before touching the overlay. `deleteLorebook` and `deleteEntry` cascade-clean overlay rows (manual, since FK enforcement is off in dev.db). `deleteLorebook` also now cleans up orphan entries (pre-existing bug, fixed here).

**Pipeline integration.** `/api/chat-generate` loads the user's enabled lorebook ids, fetches their entries, filters out user-disabled entries, and passes the result as `extraLoreEntries` to `buildChatPrompt`. `context-builder.ts` accepts the new param, merges with the character's embedded book, and **pre-filters `disable: true` on both sources** so disabled entries don't activate during the initial scan (pre-existing bug: `scanLoreEntries` only checks `disable` in the recursion loop, not initial). The `/` (index) demo pipeline and `lib/chat/pipeline.ts` are unchanged — `extraLoreEntries` defaults to `[]`.

### Backgrounds (scenes) slice

```
src/db/
  repositories/backgrounds.ts                 # list, get, create, delete (no userId — app-wide)
src/server/
  fns/backgrounds.ts                          # list, get, upload, delete; demo-restricted mutations
  schemas/background.ts                       # arktype validators
src/routes/
  api/backgrounds/$id/image.ts               # GET image bytes from disk
src/hooks/useBackgrounds.ts                   # TanStack Query hooks: useBackgrounds, useUploadBackground, useDeleteBackground
src/components/
  ChatSettingsPanel.tsx                       # SceneSection: grid of backgrounds, upload, delete, select
```

Backgrounds are **app-wide** (no `userId` column). The table stores a name and file path; images live on disk at `data/backgrounds/<uuid>.png`. The `ChatSettingsPanel`'s Scene tab shows a 3-column grid of available backgrounds — clicking one sets it as the chat's `backgroundPath`.

**Seed:** On first boot with an empty `backgrounds` table, `seedDefaultBackgrounds()` copies 20 images from `public/data/backgrounds/` (SillyTavern's shipped scenes) to `data/backgrounds/<uuid>.ext` and inserts corresponding DB rows. Utility files starting with `_` are skipped.

**Demo restrictions:** `uploadBackground` and `deleteBackground` check `isAdmin(user)` and throw. The `SceneSection` component hides the upload button and per-card delete (✕) buttons when `isDemo === true`. Demo users can still view and select any background for their chats.

### Personas slice

```
src/db/
  repositories/personas.ts                     # list, get, create, update, delete (all take userId)
  __tests__/personas.repo.test.ts              # 12 tests
src/server/
  fns/personas.ts                              # list, get, create, update, delete (arktype validators)
src/hooks/usePersonas.ts                       # TanStack Query hooks: usePersonas, useCreatePersona, useUpdatePersona, useDeletePersona (+ PersonaListItem type)
```

Persona is a simple name + description pair. No image handling yet (iconPath column is not wired in the UI). The `ChatSettingsPanel`'s Persona section provides a `<Select>` for the active persona (stored in `user_settings.defaultPersonaId`), plus Add/Edit/Delete buttons. The create dialog auto-sets the new persona as active on success. The description is injected into the chat prompt by the pipeline. The legacy migration (`scripts/migrate-data.ts` → `public/data/`) populates personas from `power_user.personas`; all rows have `iconPath` pointing to `data/personas/<uuid>.png` but the files are not copied by the CRUD UI.

### Chats slice

```
src/db/
  repositories/chats.ts                      # chat + message CRUD; CreateChatInput takes providerId/presetId/selectedModel; updateChat patches them; MessagePatch is fully optional
  __tests__/chats.repo.test.ts                # 16 tests
src/server/
  fns/chats.ts                                # list, get, getChatMessages, createChat, sendMessage, swipeMessage, deleteMessageBranch, editMessage, deleteChat, **prepareStreamMessage, finalizeStream, cancelStream, updateChatSettings**
  schemas/chat.ts                             # effect Schema validators for all of the above (grouped: CRUD, messages, streaming, settings)
src/components/
  ChatSettingsPanel.tsx                       # **Floating draggable settings modal: AI provider/model/preset, lorebooks, persona CRUD, prompt overrides**
  chat/
    CharacterPortraitPanel.tsx                # Character portrait with streaming glow ring, upload button, click-to-lightbox
    CustomImagePanel.tsx                      # Temporary per-chat image: upload zone (dashed border + file input), preview, remove, lightbox
    ImageLightbox.tsx                         # Shared Dialog lightbox for portrait or custom image
src/routes/
  chats/{index,new,$id}.tsx                   # list, new (character grid), chat UI **with streaming + floating SettingsPanel**
  api/chat-generate.ts                        # **SSE endpoint for chat-backed generation**
src/hooks/useChats.ts                         # TanStack Query hooks **+ usePrepareStream/useFinalizeStream/useCancelStream/useUpdateChatSettings**
src/stores/chat-store.ts                      # **zustand: settingsOpen, input, activePlaceholderId, recoveredFor, chatImages (per-chat temporary base64)**
```

**Hidden-root tree model.** Every chat starts with a `role: "system", isSystem: true, parentLocalId: null, content: ""` row at `localId = 0`, plus every greeting (`first_mes` + each `alternate_greetings[i]`) as its children at `localId = 1..N`. `root.selectedChildLocalId = 1` (first_mes is the default). The UI filters out `role === "system"` so the root is never rendered. All other server fns reject `messageLocalId === 0`.

**Chat creation** (`createChat`): takes `{ characterId }`. Server inserts root + all greetings in one call. **Seeds `providerId`/`presetId`/`selectedModel` from `user_settings` defaults** so new chats start pre-configured. No greeting selector in the UI — character click → create → navigate to `/chats/$id`.

**Swipe behavior** (`swipeMessage`): operates on an arbitrary `messageLocalId` in the active path.

- Existing next/prev sibling: `selectChild(parent, sibling)`, persist parent's `selectedChildLocalId`. Old branches stay in the tree, just not visible.
- Prev + no sibling: no-op (defensive; UI disables the left arrow at `siblingIndex === 0`).
- Next + no sibling: right arrow is never disabled; server creates a new sibling:
  - **User message** (role=user, `is_user=true`) → empty user draft, `extra: { isDraft: true }`. User types and sends to populate.
  - **Greeting** (`parent_id === 0`, role=assistant) → assistant with fixed content `"Make your own greeting!"`. User opens the existing Edit button to author the opening.
  - **Other assistant** (a non-greeting reply at the end of its sibling list) → regenerate via streaming pipeline (see below); falls back to `pickDefaultReply` when no AI is configured.

**Send behavior** (`sendMessage`): server detects the active leaf. If `extra?.isDraft === true` (draft user message from swipe-right), populates the draft in place: set `content`, clear `extra`, then `addChild(reply)` under it. Otherwise: append new `userMsg` as child of active leaf, then `addChild(reply)` under the new userMsg. Uses rotating `DEFAULT_REPLIES` when no AI is configured.

**Edit message** (`editMessage`): content-only via the optional `MessagePatch` shape. Rejects drafts server-side (UI also prevents: Edit button hidden on drafts). Persists only the `content` column; no tree structure changes.

**Delete branch** (`deleteMessageBranch`): walks the subtree, deletes those messages, persists parent's `children`/`selectedChildLocalId` (auto-re-pointed by `deleteSubtree`: right-sibling → left-sibling → null, only when the deleted node was selected).

**`getNextId(tree)` ordering rule.** Allocate a new node's id *after* `addChild`-ing any previous new node, otherwise two `getNextId(tree)` calls return the same value and the second `addChild` throws "node already exists" (`tree.ts:165-166`). The `sendMessage` normal case constructs + `addChild`s the user message before allocating the reply's id for this reason.

**Streaming flow** (`prepareStream` / `finalizeStream` / `cancelStream`). The chat UI uses `@tanstack/ai-react`'s `useChat` + `fetchServerSentEvents` to stream completions into a placeholder message.

1. User hits Send (or swipes right on the last assistant) → `prepareStream({ chatId, mode, content?, messageLocalId? })`:
   - `mode: "send"` → build user msg + assistant placeholder (`content: ""`, `extra: { isStreaming: true }`) under the active leaf (or populate an existing draft in place). `getNextId` ordering rule applies.
   - `mode: "regenerate"` → addSibling of target assistant → select it. Rejects if target is not assistant, is system, has no parent, or is still streaming.
   - Returns `{ assistantMessageLocalId }`. Client calls `setPlaceholder(id)` (zustand) then `aiChat.sendMessage(content)` or `aiChat.reload()`.
2. SSE connection body reads `useChatStore.getState().activePlaceholderId` synchronously (fixes the old ref-sync race), POSTs `{ forwardedProps: { chatId, assistantMessageLocalId } }` to `/api/chat-generate`.
3. Server builds prompt from character + active path history + chat's provider/preset/model; drops the hidden system root and any empty-content system message (openai-compatible adapters reject empty content); for greeting regenerate (no user in history) injects a `"."` sentinel user message (openai-compatible APIs reject user-less prompts). Streams the response.
4. `onFinish` → client picks the last assistant text from `aiChat.messages` → calls `finalizeStream({ chatId, messageLocalId, content })` which clears `extra.isStreaming` and writes the final `content`. Empty content → `cancelStream` instead.
5. `onError` → toast + `cancelStream` (deletes the placeholder subtree via `deleteSubtree`).
6. **Stale-stream recovery on mount.** If a DB row still has `extra.isStreaming` (interrupted page reload, etc.), the page-effect cancels it once per chat id. `recoveredFor` in the zustand store gates this so it doesn't re-run on every refetch.

**UI** (`/chats/$id`): **CSS grid layout** (`md:grid-cols-[15%_70%_15%]`) with three columns always in the DOM — no layout shift. On mobile (`<md`) collapses to single column. Left column: character portrait panel (toggled by clicking header avatar). Right column: temporary custom image panel (toggled by header image icon). Both columns always have the grid track reserved; toggle only shows/hides inner content. Portrait panel shows streaming glow ring while AI generates; both panels click-to-lightbox. A settings `⚙` button in the header toggles a **floating draggable `ChatSettingsPanel`** (`position: fixed, z-index: 50, 420px wide`). The panel has collapsible sections:
- **AI** (Provider/Model/Preset selectors + link to `/ai-playground`) — changes persist to **both** the chat row and `user_settings` defaults.
- **Lorebooks** — per-user activation Switch (opt-in, AND-disables with entry `data.disable`).
- **Persona** — active persona selector + Add/Edit/Delete (`PersonaDialog`). New persona auto-seeds as active.
- **Prompts** — per-user system prompt, post-history instructions, impersonation prompt (save on blur).

Active path filtered to skip system root. Swipe arrows on **every** message (`◀ 1/N ▶`): left disabled at `siblingIndex === 0`, right always enabled. Edit button (inline `<Textarea>` with Save/Cancel, opens per-message). Delete button (per-message, `window.confirm`). Drafts render as a faint bubble with placeholder "Type your message..." and hide all controls. Streaming placeholder renders with `✦` next to the name and an animated `▌` caret; live text from `aiChat.messages` overrides DB content while streaming. Input box at the bottom: Enter sends, Shift+Enter newline, auto-scroll on message changes.

### AI slice (`/ai-playground` + provider/preset CRUD)

```
src/db/
  repositories/aiProviders.ts                 # list/get/create/update/delete, unique (userId, name)
  repositories/presets.ts                     # list/get/create/update/delete, unique (userId, name)
  repositories/userSettings.ts                # getUserSettings, upsertUserSettings (partial patch)
  __tests__/userSettings.repo.test.ts         # 5 tests
src/server/
  fns/aiProviders.ts                          # list/get/create/update/delete (arktype validators)
  fns/presets.ts                              # list/get/create/update/delete (arktype validators)
  fns/userSettings.ts                         # get/update (effect Schema validators)
  fns/models.ts                               # listProviderModels: GET {provider.baseUrl}/models w/ Bearer
src/routes/
  ai-playground.tsx                           # full UI: provider/preset CRUD + streaming chat
  api/chat.ts                                 # SSE endpoint for playground (systemPrompt + preset + modelOptions)
src/hooks/
  useAiProviders.ts                           # TanStack Query hooks
  usePresets.ts                               # TanStack Query hooks
  useProviderModels.ts                        # TanStack Query: listProviderModels, 5-min staleTime
  useUserSettings.ts                          # TanStack Query: getUserSettings + updateUserSettings
```

`/ai-playground` is a settings + chat workbench with: provider `<Select>` + Add/Edit/Delete dialog (name, baseUrl, apiKey, defaultModel, defaultHeaders as JSON), model picker (calls `useProviderModels` → `GET /v1/models` on the provider), preset `<Select>` + Add/Edit/Delete dialog (systemPrompt, temperature, maxTokens, topP, contextSize, frequencyPenalty, presencePenalty, optional providerId/model overrides), system prompt textarea (overrides preset), and a streaming chat powered by `useChat` + `fetchServerSentEvents("/api/chat", () => ({ body: bodyRef.current }))`. The connection body is a `useRef` updated each render so the SSE body always carries the current selection.

`/api/chat` (playground): reads forwarded `providerId/model/presetId/systemPrompt`, fetches the provider, merges preset fields on top, builds messages from `body.messages` (user/assistant only, dropped system), applies `contextSize` budget trim with `ApproxTokenCounter`, prepends system prompt, streams via `@tanstack/ai` + `openaiCompatibleText(model, { baseURL, apiKey, defaultHeaders? })`. Returns `toServerSentEventsResponse(stream)`.

`/api/chat-generate` (chat-backed): reads `chatId` + `assistantMessageLocalId`, loads chat + character + active path messages from DB, drops system root and empty-content system messages, fetches the chat's provider/model/preset, calls `buildChatPrompt({ character, chatHistory, preset: presetPartial, defaultPreset: DEFAULT_PRESET, userName })` from `lib/chat/server-context.ts` (full pipeline: buildMessages → squashSystemMessages → applyCharacterNames → applyContinuePostfix → applyContinuePrefill → truncateToContext → buildOptions). For greeting regenerate (no user in prompt) injects a `"."` sentinel. Streams via openai-compatible adapter.

`user_settings` is one row per user holding the AI defaults that seed new chats, the active persona id, and prompt overrides. `upsertUserSettings(userId, patch)` inserts on first call, then applies partial updates. `updateUserSettings` is partial-patch (undefined = leave alone, null = clear). The ChatSettingsPanel's provider/model/preset handlers mirror their changes into `user_settings` so new chats inherit them. Switching provider resets model + preset on both the chat and the user default.

### Legacy migration (`scripts/migrate-data.ts`)

**Run:** `nub run migrate` (one-time; idempotent by `(userId, name)`).

Reads `public/data/` (a real SillyTavern v1.18.0 export that lives in this repo) and bulk-loads: characters + embedded books → extracted as `<char.name> [embedded]` lorebooks, standalone lorebooks (`worlds/*.json`) → lorebooks, `power_user.personas` → personas (icons copied to `data/personas/<uuid>.png`).

Not migrated: presets, chats. V3 cards rejected. `normalizeCardData` is applied before `validateCharacterCard` so legacy data passes the strict gate.

### app-level chat pipeline (`src/lib/chat/`)

- `pipeline.ts`, `preset.ts`, `pre-process.ts`, `context-builder.ts`, `lorebook.ts`, `types.ts`, `sample-data.ts` — client-side pipeline demo used by the `/` (index) route. `sample-data.ts` + `SAMPLE_CHARACTER`/`SAMPLE_CHAT_HISTORY` feed the demo.
- `server-context.ts` — the **production** bridge from DB types (`CharacterDataV2`, `LoreConfig`, `ChatMessage`) into the same pipeline. Used by `/api/chat-generate`.
- `substitute-message-macros.ts` — replaces `{{char}}`/`{{user}}` in message content (case-insensitive). 8 unit tests.
- `types.ts` defines the canonical `ChatCompletionPreset` (full preset shape) and the `PresetData` subset stored in the `presets.data` column. Server merges db preset on top of `DEFAULT_PRESET` via `mergePresetIntoPreset`.

---

## Architecture Conventions (locked)

- **Layering:** route/hook → `createServerFn` (validator + auth check) → repository (drizzle) → `db`. Streaming endpoints are `createFileRoute` API routes (not server fns) because they return `Response` objects (SSE).
- **Validators:** effect `Schema` for chat fns (grouped in `src/server/schemas/chat.ts`); arktype for provider/preset/models fns. `ArkErrors` union doesn't satisfy `ValidateSerializable`, so chat fns use plain `(data: unknown) => CleanType` wrappers that rethrow on error.
- **IDs:** `crypto.randomUUID()` for text-pk entities; `getNextId(tree)` for chat message localIds. Always addChild a node before allocating the next id in the same operation.
- **Timestamps:** `integer` unix ms, `createdAt`/`updatedAt`.
- **Repositories throw** on not-found / wrong-user (no silent nulls) — server fns map to 404/403.
- **Query keys:** colocated per hook file (`characterKeys`, `lorebookKeys`, `chatKeys`, `aiProviderKeys`, `presetKeys`, `userSettingsKeys`, `providerModelsKey`). Invalidation: `queryClient.invalidateQueries({ queryKey: entityKeys.all })` on success.
- **`noUnusedLocals`/`noUnusedParameters` ON** — keep imports tight, prefix unused with `_` if needed.
- **Server fn strictness:** `strict: { output: false }` on fns returning `Character` (the `Record<string, unknown>` in st-core's `CharacterBook.extensions` and `CharacterExtensions` isn't statically serializable). All chat + provider + preset fns use it.
- **Avatar/persona icons on disk** at `data/avatars/<uuid>.png` and `data/personas/<uuid>.png`, served by API routes. Sibling dirs. Gitignored.
- **Streaming body sync:** SSE connection body getters read state via `useChatStore.getState()` (zustand) or a `useRef` updated each render — never close over stale values. Fixes the original `useState` + `useRef` + `useEffect` sync race.
- **SSE response shape:** always `toServerSentEventsResponse(stream)` from `@tanstack/ai`; never throw — catch and return `new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } })`.

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
| OpenAI-compat provider | `openaiCompatibleText(model, { baseURL, apiKey, defaultHeaders? })` from `@tanstack/ai-openai/compatible` | One adapter type for all providers; works with any spec-compliant endpoint. |
| AI config storage | `chats.providerId/presetId/selectedModel` per-chat + `user_settings.*` defaults | Per-chat overrides; user-level seed for new chats. |
| User-level defaults update | Sidebar changes mirror to `user_settings` | Provider change also clears model + preset on both layers. |
| Streaming placeholder | `extra: { isStreaming: true }`, content="" | DB is durable across reloads; mount effect recovers stale placeholders. |
| Stale-stream recovery | `recoveredFor` in zustand gates once-per-chat-id cancellation | Avoids re-cancelling on every messages refetch. |
| Empty content drop from prompt | Hidden system root + empty-content system messages filtered out | openai-compatible adapters reject empty user content with misleading error. |
| Greeting regenerate sentinel | Inject "." user message when prompt has no user turn | openai-compatible APIs reject user-less prompts. `aiChat.sendMessage(".")` triggers the stream (non-whitespace required to bypass the `chat-client.js:548` trim guard); `aiChat.reload()` no-ops without a prior user turn. |
| AI provider secret storage | Plain text in `ai_providers.api_key` for now | `docs/todos.md` tracks the encryption follow-up. |
| Lorebook activation default | **Opt-in / disabled by default** | No `user_lorebook_settings` row = disabled. Matches SillyTavern; no surprise lore injections on new/imported lorebooks. |
| Per-user entry disable semantics | **AND with `data.disable`** | `!data.disable && !userOverlay`. Author's global disable wins; per-user toggle can only further restrict, never re-enable. UI locks the switch off when `data.disable` is true. |
| Overlay table shape | **Presence = state (no boolean column)** | `user_lorebook_settings` row present = enabled. `user_lore_entry_settings` row present = user-disabled. No dead rows; `setLorebookEnabled(_, _, true)` upserts, `setLorebookEnabled(_, _, false)` deletes. |
| Standalone lorebooks in chat prompt | **Loaded by `/api/chat-generate` only** | Pipeline is character-chat-scoped. The `/` demo pipeline and `/api/chat` (playground) don't merge enabled lorebooks. |
| Disabled-entry pre-filter | **Applied in `context-builder` before `scanLoreEntries`** | Filters `disable: true` from both embedded + extra entries so it takes effect in the *initial* scan (the scan's recursion check missed the initial pass). |
| World-file import normalization | **Always normalize, never store raw** | `parseWorldFile` maps `insertion_order→order`, `enabled→disable` (inverted), `position` string→enum, flattens `extensions.*`, accepts `key`/`keysecondary` as array or comma-separated string, validates per-entry via `LoreEntrySchema`. Result: imported lorebooks are immediately usable by the chat pipeline. The one-time `scripts/migrate-data.ts` still uses raw insertion (storing entries without the `LoreEntry` shape) — its lorebooks are NOT usable in chats; refactor is a follow-up. |
| Imported lorebook activation | **Disabled by default** | Matches the opt-in design. User must toggle on from the list page after import. |
| Message macro substitution | **{{user}}→persona name, {{char}}→character name** on all stored messages | `resolveUserName()` looks up active persona via `user_settings.defaultPersonaId`, falls back to `user.name`. Substitution applied server-side at every persistence point: `createChat` (greetings), `sendMessage`, `prepareStream`, `editMessage`, `finalizeStream`. |
| Chat side panels | **CSS grid 15/70/15 (md+), always in DOM** | Side columns always have the grid track (no layout shift). Toggle only shows/hides inner content. Columns have no background — single background image extends across all three columns. Below md: single column, side divs hidden. |
| Custom chat images | **Temporary, per-chat, base64 in zustand** | Store: `useChatStore.chatImages[chatId]`. Gone on reload. No DB, no file storage, no server fns. Left panel also has upload button that stores to same key (appears in right panel). |

---

## Known Issues

- **FK enforcement off in dev.db** — `drizzle.config.ts` + `src/db/index.ts` do not set `PRAGMA foreign_keys = ON` per connection. `ON DELETE CASCADE` clauses are in the schema and would take effect on any client that enables enforcement, but in dev they don't. Workaround: manual wipes must also delete `lore_entries` and `chat_messages` explicitly.
- **AI provider API keys stored in plain text** — see `docs/todos.md` for the encryption follow-up. Same applies to any future `user_settings` extension that holds secrets.
- **Typecheck noise** — 2 pre-existing errors (drizzle.config.ts:6 `string | undefined` for `DATABASE_URL`; st-core/transform/regex.ts:161 `noUnusedLocals`). Do not fix unless asked. See AGENTS.md.
- **Chat server fns have no integration tests** — the 16 chats repo tests cover CRUD at the drizzle layer, but the `sendMessage` / `swipeMessage` / `deleteMessageBranch` tree-branching logic (`getNextId` ordering, `addChild` auto-select, `deleteSubtree` re-pointing, draft detection) is only verified by manual smoke. The chat-tree primitives are unit-tested in `src/lib/st-core/chat-tree/tree.test.ts` (75 tests) but the wiring is not. The same applies to `prepareStream`/`finalizeStream`/`cancelStream` — verified manually, no integration tests.
- **AI provider/preset server fns have no tests** — only the `userSettings` repo has 5 tests. The provider/preset CRUD paths follow the same drizzle pattern as characters/lorebooks but aren't covered.
- **Empty unmount cleanup effect in `/chats/$id`** — `src/routes/chats/$id.tsx:279-287` has a `useEffect` that returns a no-op cleanup. Comment claims it should clear state on chat navigation, but the body is empty. Likely a leftover; either implement or remove.
- **Migration user-table FK mismatch risk** — the migration inserts a `user` row with `id = "default-user"` but `account`/`session`/etc. cascade-delete from `user`. If a future wipe deletes users, the migration's seeded user is also gone. Workaround: re-run `nub run migrate` to recreate.

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
| Generate new route tree | `nub run generate-routes` |

---

## Branch State

```
e5027de fix(chat): resolve {{user}} to active persona name instead of user.name
58621ba feat(chat): substitute {{char}} and {{user}} in all persisted message content
80648ae feat(markdown): showdown+DOMPurify renderer, CSS sandboxing, dialogue highlighting, morphdom streaming
2b5615d feat(chat): improve layout, scrolling, bubble opacity; replace streamdown with showdown+dompurify
c562c87 feat(characters): restructure detail page, add tagline, clickable cards with tag filtering
565fc28 feat(backgrounds): add background image CRUD and scene customization
c8044bc refactor(logging): replace full LLM payload dump with step-by-step pipeline logs
8e66bbf feat(chat): AI impersonation writes user's next message into input box
6461761 feat(chat): empty Send generates AI response from active leaf
9662fef fix(chat): constrain ChatSettingsPanel content within panel bounds
```

Everything above is committed to `main`. All migrations (`0000` through `0005`) are generated. `dev.db` must have them applied (`nub run db:migrate`).

**Uncommitted:** side panels (CSS grid layout, CharacterPortraitPanel, CustomImagePanel, ImageLightbox, chat-store chatImages), upload button on left panel, docs update.

Tests pass: **222/222**. Typecheck clean (only 2 pre-existing errors: `drizzle.config.ts`, `transform/regex.ts`).
