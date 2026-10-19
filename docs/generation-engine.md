# Generation engine v2

The chat generation path is rebuilt on **Effect 4** (application lifecycle) and
**TanStack AI 0.69** (agent runtime, tools, streaming, persistence).

## Boundaries

| Layer | Path | Responsibility |
|---|---|---|
| Contracts | `src/features/generation/contract.ts` | Prompt modes, snapshot, job/proposal views |
| Errors | `src/features/generation/errors.ts` | Tagged errors + HTTP/code mapping |
| Prompt compiler | `src/features/generation/prompt.ts` | One compiler for chat, impersonate, image, rewrite, transform |
| Provider | `src/features/generation/provider.ts` | OpenAI-compatible adapter + Chat Completions options |
| Tools | `src/features/generation/tools.ts` | `read_lore`, `read_character`, `read_scene` + client tool definitions |
| Persistence | `src/features/generation/persistence.ts` | SQLite `ChatPersistence` (messages, runs, interrupts, metadata) |
| Effect service | `src/features/generation/service.ts` | `ManagedRuntime` job service used by server fns/routes |
| Jobs | `src/db/repositories/generation.ts` | Active-job gate, lease, proposals, revisions |
| Chat stream | `src/routes/api/generation/chat.ts` | SSE stream + server-side finalize + `persistence: true` hydrate |
| Client | `src/features/chat/ui/hooks/use-generation-chat.ts` | `useChat({ persistence: true, threadId })` |
| Proposals | `src/features/generation/proposal.ts` | Non-streaming impersonate/image/rewrite/transform runner |

## Chat send flow

1. `prepareGenerationFn` creates a `generation_jobs` row (idempotent by
   `requestId`) and fails fast if the chat already has an active job.
2. It appends the user turn and an empty streaming assistant placeholder, then
   stamps `extra.generationJobId` on the placeholder.
3. The browser calls `POST /api/generation/chat` with the job id. The route
   recompiles the prompt from the database, starts a TanStack `chat()` stream,
   and wraps it with `withPersistence()`.
4. On `RUN_FINISHED` the server writes the final text and marks the job
   succeeded. The client never owns finalization.
5. `useChat` hydrates its thread through `GET /api/generation/chat`, backed by
   `reconstructChat()` and the SQLite persistence stores.

System text is **only** passed through `systemPrompts`. `messages` contains
user/assistant turns only; the compiler never emits a system role there.

## Side paths

All four side paths use the same snapshot and compiler:

- **Impersonate**: assistant prefill + tail instruction + stop strings, then a
  speaker-label sanitizer. The result is a draft until the composer applies it.
- **Image**: scene-delta-only system instruction, then a deterministic
  assembler that puts canonical character tags and the style suffix around the
  model delta.
- **Rewrite**: proposal row with `targetLocalId`, `baseRev`, `baseHash`.
  Accepting writes the message in place and stores the previous content in
  `chat_message_revisions`.
- **Transform**: multi-select source messages, proposal output appended as a
  new assistant message. Source messages are never mutated.

Proposal acceptance is compare-and-set on the message revision; a stale
proposal returns `StaleTargetError`.

## Schema

New tables live in `drizzle/0022_generation_engine.sql`:

- `generation_jobs` — one active job per chat via a partial unique index.
- `generation_proposals` — pending rewrite/transform/image drafts.
- `chat_message_revisions` — rewrite/undo history.
- `ai_chat_threads`, `ai_runs`, `ai_interrupts`, `ai_metadata` — TanStack AI
  server persistence.

## Verification

```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/vitest run --reporter=dot
node_modules/.bin/vite build
```

The integration test `src/features/generation/proposal.integration.test.ts`
starts a local OpenAI-compatible SSE server and verifies streaming, the
impersonation sanitizer, `max_tokens` (not `max_output_tokens`), and TanStack
persistence writes.
