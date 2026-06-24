Use the fff MCP tools for all file search operations instead of default tools.

# User context
- The user is an experienced software engineer named Marv. Be direct, skip handholding, assume technical proficiency.
- Keep tasks atomic, incremental, and reviewable. Small, independent steps.

# Project state
See `docs/handoff.md` for current state, architecture, locked decisions, schema, roadmap, and how to pick up. Read it after this file.

# NubJS
All-in-one Rust toolkit for Node.js — replaces `node`, `npm`/`pnpm`, `npx`, `nvm` with one binary.

## CLI cheatsheet

| Command | What it does |
|---|---|
| `nub index.ts` | Run TS/JSX file directly (oxc transpiler, no tsc needed) |
| `nub install` | Install deps (pnpm-compatible, reads existing lockfile) |
| `nub add -E -D react` | Add dep (exact pin, devDeps — pnpm flags) |
| `nub run dev` | Run package.json script (24× faster than pnpm) |
| `nub run -r --filter "@scope/*" build` | Run script across workspace packages |
| `nubx eslint .` | Run local bin from node_modules/.bin (19× faster than npx) |
| `nub watch src/server.ts` | Graph-aware file watching |
| `nub node install 22` | Provision a Node version |
| `nub node pin 22` | Write .node-version |

## Key conventions
- **TypeScript:** runs directly, no build step. Types stripped, not checked. Keep `tsc --noEmit` for type checking.
- **Imports:** extensionless works (`./foo` → `./foo.ts`); `.js`→`.ts` swap works; tsconfig `paths`/`baseUrl` resolve at runtime.
- **Env files:** auto-loaded from nearest package.json dir (`.env.[NODE_ENV].local > .env.local > .env.[NODE_ENV] > .env`). `${VAR}` expansion works. Shell env always wins.
- **Security:** deny-by-default install. Use `nub approve-builds` to allow build scripts.
- **Node version:** resolved from `.node-version` > `.nvmrc` > `engines.node`. Auto-fetched if missing.

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
| Install deps | `nub install` |
| Add dev dep | `nub add -D <pkg>` |
| Add runtime dep | `nub add <pkg>` |
| Dev server | `nub run dev` |
| **Run tests** | `nub run test` |
| **Run legacy migration** | `nub run migrate` |
| Lint | `nubx oxlint src/` |
| Format | `nubx oxfmt src/` |
| Typecheck | `npx tsc --noEmit` |
| Drizzle studio | `nub run db:studio` |

# Known typecheck noise
Pre-existing and expected — do not fix unless asked:
- `src/lib/st-core/transform/regex.ts:161` — `'params' is declared but its value is never read` (`noUnusedLocals`). st-core copied as-is.
- `drizzle.config.ts(6,29)` — pre-existing `string | undefined` issue with `DATABASE_URL`. Surfaced by `npx tsc --noEmit`.
