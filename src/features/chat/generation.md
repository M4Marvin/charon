# Generation Module

AI orchestration: SSE streaming, provider resolution, impersonation, lock lifecycle.

Built on top of `tree/` (message storage + branching) and `lock/` (generation mutex). The generation module is a sibling to tree — it calls into tree's service functions but owns the AI integration layer.

## Module Structure

```
generation/
├── types.ts           # ProviderConfig, ResolvedProvider, PromptContext, GenerationContext
├── default-replies.ts # Random fallback phrase picker (no-AI case)
├── provider.ts        # resolveProvider(userId, db?) — user-scoped provider + model + preset resolution
├── prompt-context.ts  # loadGenerationContext (combined loader), buildPromptFromContext convenience
├── service.ts         # prepareStream (send/regenerate/continue), finalizeStream, cancelStream
├── impersonate.ts     # Non-streaming LLM call with injectable fetch
├── fns.ts             # createServerFn wrappers (Effect Schema validators + auth)
└── service.test.ts    # 20 integration tests (17 streaming + 3 impersonation)
```

## API Reference

### `provider.ts`

```typescript
export async function resolveProvider(userId: string, db?: DB): Promise<ResolvedProvider>
```

Resolves the user's default AI provider, model, and preset. Throws `"No provider configured"` or `"No model configured"`. The returned `apiKey` is already decrypted by the repository layer. Maps `PresetData.maxTokens` → `ChatCompletionPreset.maxResponseLength`.

### `prompt-context.ts`

```typescript
export async function loadGenerationContext(
  userId: string,
  fallbackUserName: string,
  chatId: string,
  assistantMessageLocalId: number,
  db?: DB,
): Promise<GenerationContext>

export function buildPromptFromContext(ctx: PromptContext): BuildChatPromptResult
```

`loadGenerationContext` is the single entry point for all prompt-building data. It loads:
- Chat row + character data
- Full message tree → active path (via `getPathToNode`)
- User settings → provider + model + preset (calls `resolveProvider` internally)
- Enabled lorebooks + entries (filtered by user-disabled + `data.disable`)
- Persona (description + name override)

`buildPromptFromContext` is a thin convenience that passes the context straight into `buildChatPrompt`. `PromptContext` is a structural subtype of `BuildChatPromptInput`.

### `service.ts`

```typescript
export function prepareStream(
  userId: string,
  input: PrepareStreamInput,
  userName: string,
  db?: DB,
): PrepareStreamResult

export function finalizeStream(
  userId: string, chatId: string, messageLocalId: number,
  content: string, userName: string, db?: DB,
): { messageLocalId: number; content: string }

export function cancelStream(
  userId: string, chatId: string, messageLocalId: number, db?: DB,
): { deletedIds: number[] }
```

All three are **synchronous** (better-sqlite3 is sync). Character loading and persona resolution are internal — the caller only provides the session `userName` as fallback.

**`prepareStream` modes:**

| Mode | Behavior |
|------|----------|
| `send` | Creates user message + assistant placeholder under active leaf. If no provider configured, writes a fallback reply from `pickDefaultReply()` directly — no lock, no streaming. Otherwise acquires lock on placeholder. |
| `regenerate` | Validates target is assistant, non-root, not streaming. Creates a **new sibling at the end** of the parent's children via `appendSibling` (not `swipe` — swipe could navigate to an existing sibling). Acquires lock. |
| `continue` | Creates a new assistant message. If active leaf is a user: appends a child placeholder. If active leaf is an assistant: appends a sibling at the end. Acquires lock. |

**Lock ordering invariant:**

`finalizeStream` uses the **repository-level** `updateMessage` (which has no `ensureChatIdle` check) to write content + clear `extra` while the lock is held. It releases the lock **last**. This avoids a race window between release and write.

`cancelStream` uses `deleteBranch` with `{ skipIdleCheck: true }` to delete the placeholder subtree while the lock is held, then releases last.

### `impersonate.ts`

```typescript
export async function impersonateMessage(
  userId: string, chatId: string, userName: string,
  options?: ImpersonateOptions, db?: DB,
): Promise<{ text: string }>
```

Non-streaming LLM call. The `fetchFn` parameter on `ImpersonateOptions` enables test injection without mocking global fetch.

**Prompt construction (differs from `buildChatPrompt`):**
Rather than using `buildPromptFromContext` (which includes a "write as {{char}}" system prompt), impersonation builds messages manually:

1. **Impersonation instruction** (system) — from `userSettings.impersonationPrompt` or a default
2. **Character context** (system) — name, description, personality, scenario (character's state, NOT a "write as char" directive)
3. **User persona** (system, if set) — user's roleplay identity
4. **Chat history** (user + assistant messages only, no system messages)

This avoids conflicting instructions — the model sees only one "who to write as" directive.

**Guard:** Requires at least one user message in the conversation. Refuses to impersonate on a chat with only greetings.

**Provider call:** Raw `fetch` POST to `{baseUrl}/chat/completions` with only `{ model, messages, stream: false }`. No `modelOptions` spread — avoids sending non-standard keys (`max_output_tokens`, `verbosity`, `systemPrompt`) to the provider.

### `fns.ts`

```typescript
export const prepareStreamFn    // POST, validates PrepareStreamSchema
export const finalizeStreamFn   // POST, validates FinalizeStreamSchema
export const cancelStreamFn     // POST, validates CancelStreamSchema
export const impersonateFn      // POST, validates ImpersonateSchema
```

Thin `createServerFn` wrappers. Each handler calls `getSession()` then delegates to the corresponding service function. No data loading in the fns — all character/user lookups are inside the service layer.

## Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| All service fns sync | Synchronous | better-sqlite3 is sync. Provider resolution is async (decrypts keys) but only `prompt-context` and `impersonate` need it |
| `prepareStream` send-mode no-AI check | Sync check on `defaultProviderId` only | Keeps `prepareStream` sync. If `providerId` exists but row deleted, the SSE endpoint errors — rare and recoverable |
| Fallback reply placement | Owned by generation module (`default-replies.ts`) | Tree module stays content-agnostic |
| `draft` compat | Dropped entirely | Tree never creates drafts. Inline edit handles old draft messages |
| Regenerate/continue sibling creation | `appendSibling` (always appends at end) | `swipe`'s `createSiblingAndSelect` inserts after target — wrong for regenerate when later siblings exist. `appendSibling` uses `addChild` which appends at end |
| Persona name for macros | Persona name > account name | `resolveUserName` checks persona first, falls back to session name. Applied to both `substituteMessageMacros` and `buildChatPrompt.userName` |
| `impersonate` location | Separate file, raw `fetch` | Different transport from streaming; `@tanstack/ai` is streaming-only |
| Default impersonation prompt | Roleplay-optimized | "Write {{user}}'s next message in the roleplay..." — enforces character boundaries, style matching, no OOC commentary. Supports both `{{user}}` and `{{char}}` tokens |

## SSE Pipeline (Production)

The SSE endpoint at `src/routes/api/chat-generate.ts` is the **production** streaming path. The client calls `prepareStreamFn` to create the placeholder, then opens an SSE connection to `/api/chat-generate` with `{ chatId, assistantMessageLocalId }`.

**Client → Server flow:**
1. Client calls `prepareStreamFn` → placeholder created, lock acquired
2. Client opens SSE connection to `/api/chat-generate` with the placeholder's localId
3. Server calls `loadGenerationContext` → loads all context + resolved provider
4. Server calls `buildPromptFromContext` → assembles the LLM prompt
5. Server creates adapter via `openaiCompatibleText`, creates stream via `aiChat()`, returns SSE response
6. Client reads SSE stream, shows tokens in real-time
7. On stream finish: client calls `finalizeStreamFn` → writes content, clears lock
8. On error: client calls `cancelStreamFn` → deletes placeholder, clears lock

## Debugging Learnings

### `@tanstack/ai-react` body format

When using `fetchServerSentEvents(url, () => ({ body: { ... } }))`, the library nests the factory's `body` value under a `data` field in the POST request, NOT at the root:

```json
{
  "data": {"chatId": "...", "assistantMessageLocalId": 22},
  "forwardedProps": {"chatId": "...", "assistantMessageLocalId": 22},
  "messages": [...],
  "threadId": "...",
  "runId": "...",
  "state": {},
  "tools": [],
  "context": []
}
```

The SSE endpoint must read extra fields from `body.data`, not from the root of the parsed JSON. The `forwardedProps` field is a TanStack Router convention and mirrors `data`. Use `body.data` — it's the AG-UI protocol field.

### `useAiChat` caches the first connection

`useAiChat` from `@tanstack/ai-react` captures the `connection` prop on the **first render only**. Subsequent changes to `connection` (e.g. via `useMemo([selectedChatId])`) are ignored. The factory function in `fetchServerSentEvents` is the closure that was created on the first render.

**Fix:** Don't use state variables in the factory closure. Use **refs** instead:

```typescript
// ❌ Broken — selectedChatId captured once, never updates
const connection = useMemo(() =>
  fetchServerSentEvents("/api/chat", () => ({ body: { chatId: selectedChatId } })),
  [selectedChatId],
);

// ✅ Works — refs always return the latest value
const chatIdRef = useRef(selectedChatId);
useEffect(() => { chatIdRef.current = selectedChatId }, [selectedChatId]);

const connection = useMemo(() =>
  fetchServerSentEvents("/api/chat", () => ({ body: { chatId: chatIdRef.current } })),
  [],
);
```

This matches the production chat page's pattern: `useChatStore.getState()` is ref-like (zustand's `getState()` always returns the latest value).

### Structured logging vs `console` in TanStack Start API routes

The `@/features/logging` module (`createLogger`) uses `createIsomorphicFn` from `@tanstack/react-start`, which exhibited inconsistent behavior when imported in API route files. For SSR stability, the SSE endpoint uses raw `console.log`/`console.error` instead. The rest of the generation module (service, provider, prompt-context, impersonate) uses `createLogger` normally since they run inside server functions, not API route handlers.

## Demo Page

A developer playground at `/demo/generation` provides an interactive UI for manual testing:

- **Chat selector** + message tree + full PromptContext display
- **Generation controls**: send/regenerate/continue with the full pipeline (prepare → SSE stream → auto-finalize)
- **Live stream output**: real-time token display with status indicators
- **Impersonate**: calls the impersonation endpoint and shows the returned text
- **Workflow guide**: step-by-step instructions for each operation
