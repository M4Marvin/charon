# Generation engine v2

The chat generation path uses **TanStack AI 1.2** and **`@tanstack/ai-effect`
0.1** for an Effect-native provider stream and tools, and **Effect 4.1** for
schema validation, services, Layers, and tagged errors. There is no managed
Effect runtime and no TanStack state-persistence layer: `chat_messages` remains
the canonical transcript, and resumable delivery is handled separately by the
SSE durability adapter.

## Boundaries

| Layer | Path | Responsibility |
|---|---|---|
| Contracts | `src/features/generation/contract.ts` | Prompt modes, snapshot, proposal view |
| Errors | `src/features/generation/errors.ts` | Tagged errors + HTTP/code mapping |
| Prompt compiler | `src/features/generation/prompt.ts` | One compiler for chat, impersonate, image, rewrite, transform |
| Provider | `src/features/generation/provider.ts` | OpenAI-compatible adapter + Chat Completions options |
| Tools | `src/features/generation/tools.ts` | `AI.serverTool` Effects for `read_lore`, `read_character`, `read_scene` |
| Effect provider stream | `src/features/generation/chat-stream.ts` | `AI.chat` + `Stream.provide(ReadToolRuntime)` → async iterable |
| Jobs | `src/db/repositories/generation.ts` | Active-job gate, lease, proposals |
| Finalize | `src/features/generation/finalize.ts` | Transactional message + job finalization |
| Chat stream | `src/routes/api/generation/chat.ts` | SSE stream + server-side finalize + delivery resume |
| Client | `src/features/chat/ui/hooks/use-generation-chat.ts` | `useChat` transport, stream text, cancellation |
| Proposals | `src/features/generation/proposal.ts` | Impersonate/image/rewrite/transform runner |

## Chat send flow

1. `prepareGenerationFn` validates the request and loads the chat config.
2. It creates a `generation_jobs` row and appends the user turn plus an empty
   streaming assistant placeholder in one SQLite transaction.
3. The browser calls `POST /api/generation/chat` with the job id. A resume
   request is replayed from the durability log before any job side effects.
4. The route recompiles the prompt from the database and starts an `AI.chat`
   Effect stream through `makeGenerationStream`. The read-tool Layer supplies
   the request's DB, user, and chat. Heartbeats extend the job lease while the
   async iterable streams.
5. On `RUN_FINISHED` the server writes the final text and marks the job
   succeeded in one transaction. The client never owns finalization.

## Effect runtime and tools

`makeGenerationStream` is the only place that builds the provider stream:

```ts
AI.chat({
  adapter,
  messages: compiled.messages,
  systemPrompts: compiled.systemPrompts,
  modelOptions: { ...compiled.modelOptions, ...(compiled.stop ? { stop: compiled.stop } : {}) },
  tools: readTools,
  threadId: chatId,
  runId: job.id,
}).pipe(Stream.provide(makeReadToolLayer({ db, userId, chatId })))
```

- `AI.chat` returns `Stream<StreamChunk, AIError>`. `Stream.toAsyncIterable`
  feeds the existing `finalizeOnTerminal` wrapper, so job transitions and
  durable finalization are unchanged. A thrown `AIError` is recorded as
  `provider_error`, not as a finalize failure.
- Tools are `AI.serverTool` values and return Effects. `ReadToolRuntime`
  carries the request DB/user/chat; the Layer is built per request. The old
  lazy server-module imports are gone.
- Tool schemas use `AI.toolSchema`, which closes every object
  (`additionalProperties: false`). `Schema.toStandardJSONSchemaV1` left objects
  open, so OpenAI silently downgraded the tools to `strict: false`. The
  integration test in `src/features/generation/tool-call.integration.test.ts`
  asserts `strict: true` and executes a real `read_scene` tool call through
  `AI.chat`.
- A tool failure is a tool result for the model; it does not fail the stream.
  The read tools use `GenerationValidationError` for input/chat validation.
- Interruption: `AI.chat` aborts the provider when the consumer finalizes the
  stream. The app's SSE encoder deliberately detaches on browser disconnect and
  keeps consuming, so a dropped client does not cancel a run that the server
  can still finalize. The Stop RPC remains the explicit cancel path. This is
  why the route does not copy the tutorial's bare `POST` handler.
- `chatParamsFromRequest` is not used: the app compiles the prompt from its own
  messages and sends a prepared `jobId`, not a client-supplied message list.

System text is passed through `systemPrompts`. `messages` contains the
conversation plus user/assistant depth inserts; TanStack's `ModelMessage` has no
system role, so system-role depth entries stay in `systemPrompts` and cannot be
placed mid-history.

## Prompting

The compiler supports all five modes and applies:

- Macro expansion to authoring text (system prompt, character fields, lore,
  examples, impersonation instruction) but never to persisted message content.
- Lorebook scanning through `scanLoreEntries`: enabled entries are activated by
  keys/constants, deduplicated, and injected at their configured position
  (`Before`, `After`, `AtDepth`). The card's embedded `character_book` is
  merged with the standalone enabled lorebooks; uids are re-based to avoid
  collisions.
- Character depth prompts at their configured depth. System-role depth content
  is appended to `systemPrompts`.
- Rewrite/transform instructions as an explicit `Instruction:` system prompt.

## Side paths

All four side paths use the same snapshot and compiler:

- **Impersonate**: assistant prefill + tail instruction + stop strings, then a
  speaker-label sanitizer. The result is a draft until the composer applies it.
- **Image**: scene-delta-only system instruction, then a deterministic
  assembler that puts canonical character tags and the style suffix around the
  model delta.
- **Rewrite**: proposal row with `targetLocalId`, `baseRev`, `baseHash`.
  Preparing captures a hash of the current content; editing a message bumps
  `rev` and `contentHash`. Accepting compares both and returns
  `StaleTargetError` if the target changed.
- **Transform**: multi-select source messages plus a custom prompt. The result
  is inserted into the composer as an editable draft; nothing is written to the
  chat and the source messages are never mutated.

Proposal acceptance is compare-and-set on the message revision and content hash.
There is no undo/revision table; a rewrite overwrites the target after the CAS
check.

## Schema

The generation tables live in `drizzle/0022_generation_engine.sql` and are
pruned by later migrations:

- `generation_jobs` — one active job per chat via a partial unique index.
  Stores trigger, prompt mode, lease, placeholder, target and input. Dead
  columns (`request_id`, `base_leaf_id`, `attempt`, `draft_text`,
  `chunk_seq`, `requires_confirmation`) were dropped in 0024.
- `generation_proposals` — pending rewrite drafts; impersonate, image, and
  transform results are recorded as accepted because they are consumed in the
  composer.

The TanStack AI persistence tables were removed in 0023 because the UI renders
the app's canonical message tree, not a hydrated TanStack thread.

Resumable delivery uses the POST `durability` adapter (`memoryStream`). It is a
single-process delivery log, not a saved conversation.

## Verification

```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/oxlint src
node_modules/.bin/vitest run --reporter=dot
node_modules/.bin/vite build
```

The integration tests start a local OpenAI-compatible SSE server:

- `src/features/generation/proposal.integration.test.ts` verifies streaming,
  the impersonation sanitizer, `max_tokens` (not `max_output_tokens`), proposal
  acceptance, and that a pre-stream setup failure fails the job instead of
  wedging the chat.
- `src/features/generation/tool-call.integration.test.ts` verifies strict tool
  schemas, the Effect `read_scene` tool through `AI.chat`, and the tool result
  being sent back to the model.


## Dependencies

Pinned for this path: `@tanstack/ai` 1.2.0, `@tanstack/ai-effect` 0.1.0,
`@tanstack/ai-react` 1.0.2, `@tanstack/ai-openai` 1.1.1, `effect` 4.1.2.
`@tanstack/ai-effect` requires Effect 4.1+ and TanStack AI 1.2+, so these move
together.
