Use the fff MCP tools for all file search operations instead of default tools.

# User context
- The user is an experienced software engineer named Marv. Be direct, skip handholding, assume technical proficiency.
- Keep tasks atomic, incremental, and reviewable. Small, independent steps.

# Project state
See `docs/handoff.md` for current state, architecture, locked decisions, schema, roadmap, and how to pick up. Read it after this file.

# pnpm
Package manager used for all Node.js operations. Path: `/Users/marvinprakash/Library/pnpm/bin/pnpm`

# TanStack Start
Full-stack React framework: TanStack Router + Vite.

## Gotchas
- Don't use client-only APIs (`window`, `localStorage`) inside `createServerFn` handlers.
- Server fns require proper `method: 'GET' | 'POST'` matching the operation.
- Validation in `.validator()` runs on the server — treat it as your primary input guard.
- Mutations: `await mutationFn({ data })` then `queryClient.invalidateQueries({ queryKey })` to refetch.
- API routes: catch and return `new Response("...", { status })` directly. Don't throw.

# st-core (`src/lib/st-core/`)
Extracted core libraries from SillyTavern, copied from `sillytavern-dev/st-core/src/`. **Do not edit without user permission.**

## Modules

| Module | Path | What it does |
|---|---|---|
| shared | `shared/` | Types, token counter, event bus, ID generator, logger, validators |
| character | `character/` | V2-only character cards, PNG read/write, validators (server-only: uses `Buffer`) |
| chat-tree | `chat-tree/` | Branching chat tree data structures + I/O |
| lorebook | `lorebook/` | Lorebook buffer, context builder, entry types/validators |
| context | `context/` | Prompt assembly, collection management, story string rendering |
| script | `script/` | STscript parser, runtime executor, scope management |
| transform | `transform/` | Text transformation macros, regex utilities |

## Import convention
Use `@/*` (not `#/*`) for st-core imports. Both map to `./src/*` via tsconfig paths, but `@/*` is preferred. st-core internal imports use `.js` extensions (`'../shared/types.js'`) which resolve under bundler-mode tsconfig.

## Server-only constraint
The `character` module (`parser.ts`, `png-encode.ts`, `serializer.ts`) uses `Buffer.from()` — a **Node-only global**. Import these **only** inside `createServerFn` server functions; importing them in a client route/component will crash at runtime. The other 6 modules are isomorphic-safe.

# Commands

| Task | Command |
|---|---|
| Install deps | `pnpm install` |
| Add dev dep | `pnpm add -D <pkg>` |
| Add runtime dep | `pnpm add <pkg>` |
| Dev server | `pnpm run dev` |
| **Run tests** | `pnpm run test` |
| **Run legacy migration** | `pnpm run migrate` |
| Lint | `pnpm run lint` |
| Format | `pnpm run format` |
| Typecheck | `pnpm exec tsc --noEmit` |
| Drizzle studio | `pnpm run db:studio` |

# Known typecheck noise
Pre-existing and expected — do not fix unless asked:
- `src/lib/st-core/transform/regex.ts:161` — `'params' is declared but its value is never read` (`noUnusedLocals`). st-core copied as-is.
- `drizzle.config.ts(6,29)` — pre-existing `string | undefined` issue with `DATABASE_URL`. Surfaced by `npx tsc --noEmit`.
