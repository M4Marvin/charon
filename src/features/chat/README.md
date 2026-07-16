# Chat Feature

The character chat experience: branching message trees, AI generation, lorebook integration, persona, per-chat configuration.

Built from scratch in `src/features/chat/`. The old chat code at `src/routes/chats/`, `src/server/fns/chats.ts`, and `src/lib/chat/` stays untouched until the new code is feature-complete.

## Status

| Module | Status | Notes |
|---|---|---|
| **tree** | ✅ Built & tested | 55 tests passing. Pure data structure ops, no AI awareness. |
| **lock** | ✅ Built & tested | 16 tests. Lock on root message's `extra` field, self-healing stale recovery. See `lock.md`. |
| **generation** | ⏳ Not started | Next up. SSE streaming + AI orchestration. |
| **prompt** | ⏳ Not started | Pure functions, depends on `tree` for history. |
| **config** | ⏳ Not started | Per-chat + per-user settings. |
| **ui** | ⏳ Not started | Routes, components, client state. |
| **data** | ⏳ Not started | Thin wrapper over `src/db/repositories/chats.ts`. |

## Directory structure

```
src/features/chat/
├── README.md           ← this file
├── architecture.md     ← 6-group boundary split, data flow
├── tree.md             ← tree module design, API, conventions
├── lock.md             ← lock design, state machine, stale recovery
├── roadmap.md          ← build order for remaining modules
├── tree/               ← ✅ built (includes `lock.ts` + `lock.test.ts`)
├── generation/         ← (future)
├── prompt/             ← (future)
├── config/             ← (future)
├── data/               ← (future)
├── routes/             ← (future — `/c`, `/c/new`, `/c/$id`)
└── ui/                 ← (future)
```

## Quick start for the next module

1. Read `architecture.md` to understand the boundary split
2. Read `tree.md` to understand the tree module's API (you'll call into it)
3. Read `lock.md` before building anything that creates a placeholder
4. Read `roadmap.md` for build order

## Key design decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| All content from caller | Tree never decides what a message says | No `DEFAULT_REPLIES`, no macro substitution, no greeting defaults — all content provided by the caller (generation or UI) |
| No `isDraft` flag | Swipe-right creates "Edit me!" placeholder, user edits inline | The draft was a UX hack that added complexity to the tree module. Existing edit flow handles it. |
| No `isStreaming` flag on messages | Lock state (`chat.lockMessageLocalId`) tells the UI which message is streaming | Per-message flags for chat-level state are wrong. Lock is the single source of truth. |
| Lock for temporal exclusivity | Swipe, generate, edit are mutually exclusive | Server enforces. No client-side `activePlaceholderId` guard needed. |
| Pure ops layer + I/O service | `operations.ts` is pure (no DB), `service.ts` does I/O | Operations are unit-testable without DB. Service uses repository. |
| All service fns take `db: DB = defaultDb` | Test injection point | Integration tests use in-memory DB. |
| Hidden root at `localId 0` | Never rendered, never mutated by external callers | UI filters `role === "system"`. All mutations reject `localId 0`. |
| `userId` is first param | No auth in service | Auth happens in `fns.ts` (future) via `getSession()`. |

## Test commands

```bash
pnpm run test                    # all tests
pnpm run test -- src/features    # only feature tests
pnpm exec tsc --noEmit           # typecheck
```
