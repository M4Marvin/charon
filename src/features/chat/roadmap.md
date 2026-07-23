# Build Roadmap

Order to build the remaining modules. Each module is testable in isolation before the next one is built.

## ✅ Phase 1: Tree (done)

Pure data structure operations. 59 tests passing.

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

## Phase 3: Generation ✅ (done)

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
- Builds prompt (calls `buildChatPrompt` via `lib/chat/server-context.ts`)
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

## Phase 4: Config

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

## Phase 5: New Chat Page

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

## Build order rationale

1. **Tree first** — foundation, no dependencies, pure data structures
2. **Lock** — small additions to tree, unlocks generation
3. **Generation** — uses tree + lock; prompt assembly via existing `lib/chat/server-context.ts`
4. **Config** — CRUD, can be built independently or alongside UI
5. **New chat page** — depends on everything above

**Order: tree → lock → generation → config + UI (parallel)**

The old "Prompt" phase was a misnomer — `buildChatPrompt` in `lib/chat/server-context.ts` already does all prompt work. The generation module wires it in via `loadGenerationContext` + `buildPromptFromContext`. Similarly, a separate "Data" module is unnecessary — the tree and generation services interact with repositories directly.
