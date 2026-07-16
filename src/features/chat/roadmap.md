# Build Roadmap

Order to build the remaining modules. Each module is testable in isolation before the next one is built.

## ✅ Phase 1: Tree (done)

Pure data structure operations. 55 tests passing.

- `src/features/chat/tree/`
- See `tree.md`

## ✅ Phase 2: Lock (done)

Lock state on root message's `extra` field. Self-healing stale recovery. Implemented in `tree/lock.ts`.

**Changes to `src/features/chat/tree/`:**

1. Add `ChatLockState` type to `types.ts`
2. Add `lockState` and `lockMessageLocalId` to `ChatDetail`
3. Update `getChat` to read root message for lock state
4. Add `ensureChatIdle` check to all mutation functions (`appendMessage`, `appendUserAndReply`, `swipe`, `deleteBranch`, `editMessage`)
5. Add `acquireGenerationLock` and `releaseLock` functions
6. Update tests: add lock tests, verify mutations are rejected when locked

**New tests:**

- `lock` state on `ChatDetail`
- Mutations rejected when locked (active)
- Mutations succeed when locked (stale — lock is cleared)
- `acquireGenerationLock` / `releaseLock` lifecycle

**Estimated size:** ~80 lines + ~6 tests

## Phase 3: Generation

AI orchestration: SSE streaming, provider calls, rate limiting, lock lifecycle.

**New module: `src/features/chat/generation/`**

Files:

- `types.ts` — streaming types, provider config
- `service.ts` — `prepareStream`, `finalizeStream`, `cancelStream`, `impersonateMessage`
- `fns.ts` — `createServerFn` wrappers
- `provider.ts` — provider/model resolution (wraps `getAiProviderWithGlobalFallback`)
- `rate-limit.ts` — wraps existing `checkRateLimit` (or reuses from `src/server/ratelimit.ts`)
- `default-replies.ts` — rotating fallback replies for no-AI case

**New route: `src/routes/api/chat-generate.ts`** (SSE endpoint)

- Reads lock from DB (gets `messageId`)
- Builds prompt (calls prompt module)
- Streams from provider
- Returns SSE response

**Generation flow:**

```
UI: send
  → prepareStream (mode: "send")
    → appendUserAndReply (user msg + empty reply)
    → acquireGenerationLock
  → SSE connection → /api/chat-generate
    → reads lock → messageId
    → buildChatPrompt
    → streams
  → onFinish → finalizeStream
    → editMessage(messageId, content)
    → releaseLock
  → onError → cancelStream
    → deleteBranch(messageId)
    → releaseLock
```

**Rate limiting:** 100/day per user, UTC midnight, admins bypass. Wraps existing `src/server/ratelimit.ts`.

**Default replies:** Rotating array of 10 phrases, used when no AI is configured. Simple counter.

**Estimated size:** ~200 lines + ~10 tests

## Phase 4: Prompt Building

Pure functions: character + history + settings + lorebooks → messages + modelOptions.

**New module: `src/features/chat/prompt/`**

Files:

- `types.ts` — `ChatCompletionPreset`, `ModelMessage`, `BuildChatPromptInput`, `BuildChatPromptResult`
- `preset.ts` — `DEFAULT_PRESET` constant
- `context-builder.ts` — message assembly + lorebook activation
- `lorebook.ts` — lorebook entry scanning
- `pre-process.ts` — squash, character names, continue, truncate
- `substitute-macros.ts` — `{{char}}`/`{{user}}` substitution
- `build.ts` — `buildChatPrompt` (production entry point, takes DB row shapes, returns model-ready messages)

**Uses:** st-core lorebook + character types, existing `src/lib/chat/` for lorebook scanner (or copy/adapt)

**Inputs (from `buildChatPrompt`):**

- `CharacterDataV2` (from chat row's `data` field)
- `ChatMessage[]` (from tree's `getActivePath` or `getPathToMessage`)
- `Partial<ChatCompletionPreset>` (from config's user/chat preset)
- `LoreEntry[]` (from config's enabled lorebooks, filtered)
- Persona description (from config's active persona)
- Per-chat character field overrides
- Per-user prompt overrides (system prompt, post-history instructions)

**Outputs:**

- `ModelMessage[]` — ready for the AI adapter
- `modelOptions` — temperature, max tokens, etc.

**Estimated size:** ~300 lines (mostly from `src/lib/chat/server-context.ts` adapted) + ~15 tests

## Phase 5: Config

Per-chat and per-user settings.

**New module: `src/features/chat/config/`**

Files:

- `types.ts` — `UserSettings`, `ChatOverrides`
- `service.ts` — `getUserSettings`, `updateUserSettings`, `getChatOverrides`, `updateChatOverrides`
- `fns.ts` — `createServerFn` wrappers
- `lorebook-activation.ts` — `setLorebookEnabled`, `setLoreEntryDisabled` (wraps existing repos)
- `persona.ts` — `getActivePersona`, persona resolution helpers
- `prompt-context.ts` — `loadPromptContext(chatId, userId)` — gathers all settings for the prompt builder

**The `loadPromptContext` function is the key one.** It replaces the duplicated data-loading in `chat-generate.ts` and `impersonateMessage`. Returns:

```typescript
{
  character: CharacterDataV2,
  provider: { baseUrl, apiKey, defaultHeaders },
  model: string,
  preset: Partial<ChatCompletionPreset>,
  defaultPreset: ChatCompletionPreset,
  persona: { name, description } | null,
  userName: string,
  extraLoreEntries: LoreEntry[],
  promptOverrides: {
    systemPrompt?: string,
    postHistoryInstructions?: string,
    impersonationPrompt?: string,
  },
  characterOverrides: {
    description: string,
    personality: string,
    scenario: string,
    systemPrompt: string,
  },
}
```

**Estimated size:** ~250 lines + ~12 tests

## Phase 6: UI

Routes, components, client state.

**New module: `src/features/chat/ui/` + `src/features/chat/routes/`**

Routes:

- `src/features/chat/routes/index.tsx` → mounted at `/c`
- `src/features/chat/routes/new.tsx` → mounted at `/c/new`
- `src/features/chat/routes/$id.tsx` → mounted at `/c/$id`

**Register in `src/router.tsx` (or wherever routes are registered):**

```typescript
const chatRoutes = createRoute({
  getParentRoute: () => rootRoute,
  path: "c",
  component: Outlet,
}).addChildren([
  { path: "/", component: () => import("@/features/chat/routes/index").then((m) => m.default) },
  { path: "new", component: () => import("@/features/chat/routes/new").then((m) => m.default) },
  { path: "$id", component: () => import("@/features/chat/routes/$id").then((m) => m.default) },
]);
```

Components:

- `ChatMessage.tsx` — render a single message bubble with edit/save inline
- `Composer.tsx` — bottom textarea, send button, impersonate button
- `CharacterPortraitPanel.tsx` — left side panel
- `CustomImagePanel.tsx` — right side panel
- `ImageLightbox.tsx` — full-screen image viewer
- `SettingsPanel.tsx` — floating settings sheet (splits from old `ChatSettingsPanel.tsx`)

Hooks:

- `useChats.ts` — TanStack Query hooks for tree operations
- `useChatGeneration.ts` — streaming lifecycle (wraps `@tanstack/ai-react`)
- `useUserSettings.ts` — config module hooks
- `useLorebooks.ts` — lorebook hooks
- `usePersonas.ts` — persona hooks

Client state:

- `chat-store.ts` — zustand: minimal — just `lockMessageLocalId` mirror for SSE body getter

**Estimated size:** ~800 lines + ~20 tests

## Phase 7: Data (optional)

The data module is mostly a re-export of `src/db/repositories/chats.ts`. May not need a separate module. The tree service already uses the repository directly.

If a separate `data/` module is desired:

- `src/features/chat/data/repository.ts` — wraps `src/db/repositories/chats.ts`
- `src/features/chat/data/types.ts` — re-exports `Chat`, `ChatMessageRow`, etc.

**Estimated size:** ~50 lines (mostly re-exports)

---

## Build order rationale

1. **Tree first** — foundation, no dependencies, pure data structures
2. **Lock** — small additions to tree, unlocks generation
3. **Generation** — uses tree + lock, depends on prompt
4. **Prompt** — pure functions, can be built independently
5. **Config** — CRUD, can be built independently
6. **UI** — depends on everything above
7. **Data** — optional refactor

**Order: tree → lock → prompt + config (parallel) → generation → UI**

This minimizes rework — each phase builds on the previous, and UI is last so we don't have to change UI as the lower layers evolve.
