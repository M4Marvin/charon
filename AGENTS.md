# User context
- The user is an experienced software engineer named Marv. Be direct, skip handholding, assume technical proficiency.
- You are not an autonomous agent. Your job is to assist the user, who is a software engineer. Operate under their direction, not independently.
- Always read relevant docs and code before acting. Do not guess.
- When you're confused or stuck, stop and ask the user. Asking for help is explicitly allowed and preferred over forging ahead with assumptions.
- Keep tasks atomic, incremental, and reviewable. Small, independent steps.

# Project state
See `CONTRIBUTING.md` for project layout, architecture, commands, and conventions. Read it after this file.

# bun
Package manager used for all Node.js operations. Install: `curl -fsSL https://bun.sh/install | bash`

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
| character | `character/` | V2 + V3 character cards, PNG read/write, validators (server-only: uses `Buffer`). V3 spec: https://github.com/kwaroran/character-card-spec-v3 |
| chat-tree | `chat-tree/` | Branching chat tree data structures + I/O |
| lorebook | `lorebook/` | Lorebook buffer, context builder, entry types/validators |
| context | `context/` | Prompt assembly, collection management, story string rendering |
| script | `script/` | STscript parser, runtime executor, scope management |
| transform | `transform/` | Text transformation macros, regex utilities |

## Import convention
Use `@/*` (not `#/*`) for st-core imports. Both map to `./src/*` via tsconfig paths, but `@/*` is preferred. st-core internal imports use `.js` extensions (`'../shared/types.js'`) which resolve under bundler-mode tsconfig.

## Server-only constraint
The `character` module (`parser.ts`, `png-encode.ts`, `serializer.ts`) uses `Buffer.from()` — a **Node-only global**. Import these **only** inside `createServerFn` server functions; importing them in a client route/component will crash at runtime. The other 6 modules are isomorphic-safe.

## Character card V3 (ccv3)
- **Parser**: `getCharacterCardSpec` and `readCharacterCard` scan PNG tEXt chunks. `ccv3` (V3) takes precedence over `chara` (V2) per the V3 spec.
- **Validator**: `validateCharacterCard` is the V2 strict gate; `validateCharacterCardV3` validates V2-required fields + optional V3 fields. Import path picks one based on the parsed `spec`.
- **Normalizer**: `normalizeV3ToV2` (in `src/lib/character/normalize.ts`) projects V3-only fields off `data` and stashes them under `data.extensions._v3` with camelCase keys. The stash preserves the original V3 data for lossless round-trip via `writeCharacterCard`.
- **Write path**: `writeCharacterCard` emits both `chara` (backfilled V2 with `creator_notes` warning) and `ccv3` (original V3) chunks for V3 cards.
