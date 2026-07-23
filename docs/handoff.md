# Chat Feature Rebuild — Complete Handoff

## Corrected Architecture

The original roadmap listed a separate "Prompt" phase. This was a misnomer. `buildChatPrompt` in `lib/chat/server-context.ts` already does all prompt assembly — character rendering, story strings, lore injection, pre-processing, truncation. It's reused by the generation module via `buildPromptFromContext`. The data-loading side (`loadGenerationContext`) was built as part of generation. There is no standalone prompt module.

Collapsed from 7 phases to 5:

| Phase | Module | Status |
|---|---|---|
| 1 | tree | ✅ Built (59 tests) |
| 2 | lock | ✅ Built (16 tests) |
| 3 | generation | ✅ Built (20 tests) |
| 4 | config | ⏳ Not started |
| 5 | ui | ⏳ Not started |

Total project tests: **412 (all passing)** across 23 test files.

## Directory Structure

```
src/features/chat/
├── README.md
├── architecture.md       Module boundary split + data flow
├── tree.md               Tree module design, API, conventions
├── lock.md               Lock design, state machine, stale recovery
├── generation.md         Generation module API, pipeline, debugging learnings
├── roadmap.md            Build order for remaining modules
├── tree/                 ✅ Phase 1 + 2
│   ├── types.ts
│   ├── operations.ts     Pure tree ops
│   ├── active-path.ts    Path computation
│   ├── lock.ts           ensureChatIdle, acquireGenerationLock, releaseLock
│   ├── service.ts        I/O layer
│   ├── service.test.ts
│   ├── operations.test.ts
│   ├── active-path.test.ts
│   └── lock.test.ts
├── generation/           ✅ Phase 3
│   ├── types.ts
│   ├── default-replies.ts
│   ├── provider.ts
│   ├── prompt-context.ts
│   ├── service.ts
│   ├── impersonate.ts
│   ├── fns.ts
│   └── service.test.ts
├── config/               ← Phase 4 (future)
└── ui/                   ← Phase 5 (future)
```

## Key Design Decisions (locked)

| Decision | Choice |
|---|---|
| No barrel index.ts | Direct imports from individual files |
| isDraft dropped | Inline edit is the standard |
| Lock ordering | Tree mutation while locked, release last |
| fallback replies | Owned by generation module |
| regenerate/continue sibling | appendSibling (appends at end) |
| Persona name priority | Persona name > account name |
| fetchServerSentEvents body | Read from body.data |
| useAiChat stale closure | Use refs, not state, in factory |
| impersonation prompt | Manual build, replaces system prompts |
| impersonation guard | Requires >=1 user message |
| impersonation fetch body | { model, messages, stream: false } only |
| SSE endpoint logging | console.log/error, not createLogger |
| Per-chat provider override | NOT wired into new pipeline yet (resolveProvider reads user_settings only). Phase 4 (config) to decide fate. ChatSettingsPanel mirrors to user_settings so mostly transparent. |

## @tanstack/ai-react Debugging Learnings

### Body nesting

`fetchServerSentEvents(url, () => ({ body: { x: 1 } }))` sends:
```
{ "data": {"x": 1}, "forwardedProps": {"x": 1}, "messages": [...] }
```
Read extra fields from `body.data`.

### Stale closure in useAiChat

`useAiChat` captures the `connection` prop on first render only. If the factory closes over state, subsequent state changes are ignored. Use refs:

```typescript
const chatIdRef = useRef(selectedChatId);
useEffect(() => { chatIdRef.current = selectedChatId }, [selectedChatId]);
// Factory reads chatIdRef.current — always fresh.
```

## Generation Module API

### types.ts

```
ProviderConfig    { baseUrl, apiKey, defaultHeaders?, defaultModel? }
ResolvedProvider  { provider: ProviderConfig, model: string, preset: Partial<ChatCompletionPreset> }
PromptContext     { character, chatHistory, preset, defaultPreset, userName, userPersona?, extraLoreEntries?, ... }
GenerationContext { prompt: PromptContext, resolved: ResolvedProvider }
PrepareStreamInput  { chatId, mode: "send"|"regenerate"|"continue", content?, messageLocalId? }
PrepareStreamResult { mode: "stream" | "fallback", assistantMessageLocalId: number }
```

### provider.ts

```typescript
resolveProvider(userId: string, db?: DB): Promise<ResolvedProvider>
// User-scoped. Throws "No provider configured" / "No model configured".
// Decrypts API key internally via repository.
// Maps PresetData.maxTokens -> ChatCompletionPreset.maxResponseLength.
```

### prompt-context.ts

```typescript
loadGenerationContext(userId, fallbackUserName, chatId, assistantMessageLocalId, db?): Promise<GenerationContext>
// Single loader: chat + character -> messages -> tree -> path -> settings -> provider -> lore -> persona.
// Resolves userName internally: persona name if set, fallbackUserName otherwise.

buildPromptFromContext(ctx: PromptContext): BuildChatPromptResult
// Convenience: passes PromptContext straight into buildChatPrompt.
```

### service.ts (all sync)

```typescript
prepareStream(userId, input: PrepareStreamInput, userName, db?): PrepareStreamResult
// send: creates user + assistant placeholder. No provider -> fallback (default reply, no lock).
// regenerate: validates target (assistant, non-root, not streaming) -> appendSibling -> lock.
// continue: user leaf -> appendMessage(child); assistant leaf -> appendSibling; root -> throws.
// Returns { mode: "stream" | "fallback", assistantMessageLocalId }.

finalizeStream(userId, chatId, messageLocalId, content, userName, db?): { messageLocalId, content }
// Validates isStreaming -> macro substitute -> repo updateMessage -> releaseLock.
// Lock held during write, released last — no race window.

cancelStream(userId, chatId, messageLocalId, db?): { deletedIds: number[] }
// deleteBranch(skipIdleCheck) while locked -> releaseLock.
```

### impersonate.ts (async)

```typescript
impersonateMessage(userId, chatId, userName, options?, db?): Promise<{ text: string }>
// fetchFn injectable via options for testing.
// Requires >=1 user message in chat (throws otherwise).
// Builds prompt manually:
//   [0] impersonation instruction (system)
//   [1] character context (bio, NOT "write as {{char}}")
//   [2] user persona (system, if set)
//   [3..N] chat history (user + assistant only)
// Clean fetch body: { model, messages, stream: false } only.
```

### fns.ts

```
prepareStreamFn({ chatId, mode, content?, messageLocalId? })
finalizeStreamFn({ chatId, messageLocalId, content })
cancelStreamFn({ chatId, messageLocalId })
impersonateFn({ chatId })
// All POST, strict: { output: false }, Effect Schema validators, getSession() auth.
```

## SSE Endpoint (`src/routes/api/chat-generate.ts`)

```
POST { chatId, assistantMessageLocalId }
// 1. getSession -> checkRateLimit
// 2. loadGenerationContext -> buildPromptFromContext
// 3. Sentinel "." injection if no user turn
// 4. openaiCompatibleText adapter -> aiChat -> toServerSentEventsResponse
// 500/400/429 JSON error responses
```

## Tree Module Additions (for generation)

### appendSibling in tree/service.ts

```typescript
appendSibling(userId, chatId, targetLocalId, msg: SiblingContent, db?): ChatMessage
// Always appends at END of parent's children (uses addChild via appendChild, not createSiblingAndSelect).
// Ensures regenerate/continue don't navigate to existing siblings.
```

### deleteBranch opts

```typescript
deleteBranch(userId, chatId, messageLocalId, db?, opts?: { skipIdleCheck?: boolean })
// skipIdleCheck bypasses ensureChatIdle — used by cancelStream which holds the lock.
```

## Demo Page (`/demo/generation`)

Developer playground for manual testing:
- Chat selector + message tree visualization + full PromptContext display + built prompt
- Generation controls: send/regenerate/continue with full pipeline (prepare -> SSE stream -> auto-finalize)
- Live stream output: real-time token display with status indicators (idle/streaming/finalizing/error/fallback)
- Impersonate: calls impersonation endpoint, shows returned text, "Copy to Send Input" button
- Workflow guide: step-by-step instructions

## Test Coverage

412 tests across 23 test files. All passing.

| Module | Test file | Tests |
|---|---|---|
| Tree (operations) | tree/operations.test.ts | 22 |
| Tree (active path) | tree/active-path.test.ts | 9 |
| Tree (lock) | tree/lock.test.ts | 16 |
| Tree (service) | tree/service.test.ts | 28 |
| Generation | generation/service.test.ts | 20 |
| Logging | logging/logger.test.ts | 25 |
| st-core (chat-tree) | lib/st-core/chat-tree/tree.test.ts | 75 |
| st-core (character) | lib/st-core/character/{parser,validators}.test.ts | 32 |
| Repos | db/__tests__/{characters,lorebooks,chats,...}.test.ts | 185 |

## Cleanup Status (COMPLETED 2026-07-24)

### Deleted from old code

| File | What was deleted |
|---|---|
| `src/server/fns/chats.ts` | `StreamResult` type, `prepareStreamMessage` (~172 lines), `finalizeStream` (~22 lines), `cancelStream` (~20 lines) |
| `src/server/schemas/chat.ts` | `PrepareStream`, `FinalizeStream`, `CancelStream` schemas |
| `src/hooks/useChats.ts` | Switched `usePrepareStream`/`useFinalizeStream`/`useCancelStream` to call `prepareStreamFn`/`finalizeStreamFn`/`cancelStreamFn` from `@/features/chat/generation/fns`. `useImpersonateMessage` was already switched. |

### Not deleted (still used by old page)

The remaining fns in `src/server/fns/chats.ts` (`sendMessage`, `swipeMessage`, `deleteMessageBranch`, `editMessage`, `updateChatSettings`, `deleteChat`, `createChat`, reads) and their schemas + types (`SendResult`, `SwipeResult`, `ChatDetail`) are preserved. The old page at `src/routes/chats/$id.tsx` (1133 lines) still uses them.

### Old page status

`/chats/$id.tsx` is **frozen**. The hook switch routes its streaming through the new lock-based code path, which may degrade it (unhandled `mode: "fallback"`, draft populate-in-place gone, lock rejections as new failure modes). Accepted — the page will be rebuilt from scratch at Phase 5.

## Phase 4: Config Module

Per-chat settings (character field overrides, lorebook toggles, persona selection) and per-user defaults (provider, model, preset). DB schema already supports these — just needs a typed access layer.

**Note:** The new `resolveProvider` reads only `user_settings` defaults, ignoring per-chat `chats.providerId/presetId/selectedModel`. The old ChatSettingsPanel mirrors changes to user_settings so this is mostly transparent, but existing chats with divergent per-chat selections will silently switch to user defaults. Phase 4 should consciously decide whether per-chat provider overrides survive.

## Phase 5: New Chat Page

Build from scratch using `generation/fns.ts`. The old page at `/chats/$id.tsx` (1133 lines) uses the old code path with zustand, inline error parsing, and hacked streaming logic. The demo at `/demo/generation` is the reference for the streaming integration pattern.

## Docs Updated 2026-07-24

- `features/chat/README.md` — 7-row status table -> 5-row; prompt/data rows removed; directory structure updated; test count corrected
- `features/chat/roadmap.md` — Phases 4 (Prompt) and 7 (Data) removed; remaining renumbered; build-order rationale updated
- `features/chat/architecture.md` — 6 groups -> 5; Prompt section removed; diagram + boundary rules updated
- `features/chat/tree.md` — test table: service.test.ts 24 -> 28
- `docs/handoff.md` — this file, replaced wholesale

## Git State

All changes from this session are uncommitted. Working tree includes:
- Dead-code cleanup (3 files)
- Doc updates (5 files)
