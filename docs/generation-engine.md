# Generation engine v2

The chat generation path uses **TanStack AI 0.69** for streaming and tools, and
**Effect 4** for schema validation and tagged errors. There is no managed Effect
runtime and no TanStack state-persistence layer: `chat_messages` remains the
canonical transcript, and resumable delivery is handled separately by the SSE
durability adapter.

## Boundaries

| Layer | Path | Responsibility |
|---|---|---|
| Contracts | `src/features/generation/contract.ts` | Prompt modes, snapshot, tool context, proposal view |
| Errors | `src/features/generation/errors.ts` | Tagged errors + HTTP/code mapping |
| Prompt compiler | `src/features/generation/prompt.ts` | One compiler for chat, impersonate, image, rewrite, transform |
| Provider | `src/features/generation/provider.ts` | OpenAI-compatible adapter + Chat Completions options |
| Tools | `src/features/generation/tools.ts` | `read_lore`, `read_character`, `read_scene` |
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
4. The route recompiles the prompt from the database and starts a TanStack
   `chat()` stream. Heartbeats extend the job lease while it streams.
5. On `RUN_FINISHED` the server writes the final text and marks the job
   succeeded in one transaction. The client never owns finalization.

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
- **Transform**: multi-select source messages, proposal output appended as a new
  assistant message. Source messages are never mutated.

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
- `generation_proposals` — pending rewrite/transform drafts and accepted
  impersonate/image results.

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

The integration test `src/features/generation/proposal.integration.test.ts`
starts a local OpenAI-compatible SSE server and verifies streaming, the
impersonation sanitizer, `max_tokens` (not `max_output_tokens`), proposal
acceptance, and that a pre-stream setup failure fails the job instead of wedging
the chat.
