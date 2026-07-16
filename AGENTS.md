# User context
- The user is an experienced software engineer named Marv. Be direct, skip handholding, assume technical proficiency.
- You are not an autonomous agent. Your job is to assist the user, who is a software engineer. Operate under their direction, not independently.
- Always read relevant docs and code before acting. Do not guess.
- When you're confused or stuck, stop and ask the user. Asking for help is explicitly allowed and preferred over forging ahead with assumptions.
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

# Shell (Nushell)

The default shell is **nushell** (`/Users/marvin/.cargo/bin/nu`), not bash. Shell commands must use nu syntax.

## Key differences from bash

| Bash | Nushell | Notes |
|---|---|---|
| `2>&1` | `out+err>\|` or `o+e>\|` | Merge stdout+stderr |
| `> /dev/null` | `\| ignore` | Discard stdout |
| `> /dev/null 2>&1` | `out+err>\| ignore` or `o+e>\| ignore` | Discard stdout+stderr |
| `>> <path>` | `out>> <path>` or `o>> <path>` | Append to file |
| `command1 && command2` | `command1; command2` | Run on success |
| `$?` | `$env.LAST_EXIT_CODE` | Exit code |
| `echo $PATH` | `$env.PATH` | View path variable |
| `export FOO=bar` | `$env.FOO = "bar"` | Set env var |
| `pwd` / `echo $PWD` | `pwd` / `$env.PWD` | Current directory |
| `man <cmd>` | `help <cmd>` | Command help |
| `command \| head -5` | `command \| first 5` | First 5 rows |
| `grep <pattern>` | `where $it =~ <substring>` or `find <substring>` | Filter strings |
| `find . -name *.rs` | `ls **/*.rs` | Recursive file search |
| `sed` | `str replace` | Find/replace in strings |

## History substitutions

| Action | Key/Command | Behavior |
|---|---|---|
| Last command | `!!` | Inserts (not auto-executes) — review before Enter |
| Last token | `!$` | Inserts last spatially-separated token |
| Nth from start | `!<n>` (e.g. `!5`) | Tip: `history \| enumerate \| last 10` to see positions |
| Nth from end | `!<-n>` (e.g. `!-5`) | Insert command from end of history |
| Starts with | `!<string>` (e.g. `!ls`) | Most recent history item beginning with string |
| Reverse search | Ctrl+R | Interactive history search |
| Edit in editor | Ctrl+O | Opens command-line in `$env.EDITOR` |

**Critical**: Unlike bash (which executes immediately after substitution), nushell **inserts** the substitution into the command-line on Enter. This lets you review and edit before executing. Same for Ctrl+O — inserts editor contents instead of auto-executing.

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
