Use the fff MCP tools for all file search operations instead of default tools.

# User context
- The user is an experienced software engineer named Marv (refer to them as "Marv" or "you"). Be direct, skip handholding, and assume technical proficiency.
- Keep tasks atomic, incremental, and reviewable. Work in small, independent steps rather than easy, verify, and revert if needed.

# NubJS

All-in-one Rust toolkit for Node.js — replaces `node`, `npm`/`pnpm`, `npx`, `nvm` with one binary.

## CLI cheatsheet

| Command | What it does |
|---|---|
| `nub index.ts` | Run TS/JSX file directly (oxc transpiler, no tsc needed) |
| `nub install` | Install deps (pnpm-compatible, reads your existing lockfile) |
| `nub add -E -D react` | Add dep (exact pin, devDeps — pnpm flags) |
| `nub remove lodash` | Remove dep |
| `nub ci` | Frozen-lockfile install |
| `nub run dev` | Run package.json script (24× faster than pnpm) |
| `nub run -r --filter "@scope/*" build` | Run script across workspace packages |
| `nubx eslint .` | Run local bin from node_modules/.bin (19× faster than npx) |
| `nub watch src/server.ts` | Graph-aware file watching (restarts on imported files + .env + tsconfig) |
| `nub node install 22` | Provision a Node version |
| `nub node pin 22` | Write .node-version |

## Key conventions

- **TypeScript:** runs directly, no build step. Types are stripped, not checked. Keep `tsc --noEmit` for type checking.
- **Imports:** extensionless works (`./foo` → `./foo.ts`); `.js`→`.ts` swap works; tsconfig `paths`/`baseUrl` resolve at runtime.
- **Env files:** auto-loaded from nearest package.json dir (`.env.[NODE_ENV].local > .env.local > .env.[NODE_ENV] > .env`). `${VAR}` expansion works. Shell env always wins.
- **JSX:** automatic runtime by default, configured via tsconfig `jsx`/`jsxImportSource`. Per-file `@jsxImportSource` pragma overrides.
- **Security:** deny-by-default install. Use `nub approve-builds` to allow build scripts. Cooling window + advisory checks on fresh installs.
- **Node version:** resolved from `.node-version` > `.nvmrc` > `engines.node`. Auto-fetched if missing.

# TanStack Start

Full-stack React framework built on TanStack Router + Vite/Rsbuild.

## CLI cheatsheet

| Command | What it does |
|---|---|
| `pnpx @tanstack/cli@latest create app` | Scaffold new project |
| `pnpm dev` | Start dev server |
| `pnpm add uuid` | Add deps |
| `pnpm build` | Production build |

## Project structure

```
src/
  routes/          # File-based routing (__root.tsx, index.tsx, ...)
  components/      # React components
  serverActions/   # Server functions (createServerFn)
  router.tsx       # Router config
  routeTree.gen.ts # Generated route tree
```

## Server functions

```ts
import { createServerFn } from '@tanstack/react-start'

export const getJokes = createServerFn({ method: 'GET' }).handler(async () => {
  const data = await fs.promises.readFile('src/data/jokes.json', 'utf-8')
  return JSON.parse(data)
})

export const addJoke = createServerFn({ method: 'POST' })
  .validator((data: { question: string; answer: string }) => {
    if (!data.question) throw new Error('question required')
    return data
  })
  .handler(async ({ data }) => {
    await fs.promises.writeFile('path.json', JSON.stringify([...]), 'utf-8')
  })
```

## Data flow pattern

- **Route loader fetches data:** `createFileRoute('/')({ loader: async () => getJokes(), component: App })` → `const jokes = Route.useLoaderData()`
- **Mutations call server fn directly:** `await addJoke({ data: { question, answer } })` → `router.invalidate()` to re-run loader
- **File-based storage:** server functions use `node:fs` to read/write JSON files. Data persists across restarts.
- **IDs:** use `uuid` for unique IDs on new records.

## Gotchas

- Don't use client-only APIs (e.g. `window`, `localStorage`) in server functions.
- Server functions require proper `method: 'GET' | 'POST'` matching the operation.
- `router.invalidate()` is the standard way to refresh data after mutations.
- Validation in `.validator()` runs on the server — treat it as your primary input guard.

# st-core (copied to src/lib/st-core)

Extracted core libraries from SillyTavern, copied from `sillytavern-dev/st-core/src/` into the TanStack app.

## Modules

| Module | Path | What it does |
|---|---|---|
| shared | `lib/st-core/shared/` | Types, token counter, event bus, ID generator, logger, validators |
| character | `lib/st-core/character/` | Read/write/validate character cards (V1-V3), PNG encoding, serialization |
| chat-tree | `lib/st-core/chat-tree/` | Chat tree data structures, tree I/O |
| lorebook | `lib/st-core/lorebook/` | Lorebook buffer, context builder, entry types/validators |
| context | `lib/st-core/context/` | Prompt assembly, collection management, story string rendering |
| script | `lib/st-core/script/` | STscript parser, runtime executor, scope management |
| transform | `lib/st-core/transform/` | Text transformation macros, regex utilities |

## Import convention

Use the `#/*` alias (or `@/*`) — both map to `./src/*`:
```ts
import { readCharacterCard } from '@/lib/st-core/character/parser.js'
import type { ChatMessage } from '@/lib/st-core/shared/types.js'
```

The `.js` extensions in st-core imports resolve correctly under bundler-mode tsconfig.

## Server-only constraint

The `character` module (`parser.ts`, `png-encode.ts`, `serializer.ts`) uses `Buffer.from()` — a **Node-only global**. Import these **only** inside `createServerFn` server functions; importing them in a client route/component will crash at runtime. The other modules (shared, chat-tree, lorebook, context, script, transform) do not use Buffer and are safe on both sides.

# Current progress

## What's been done
- st-core copied to `src/lib/st-core/` (42 files, 7 modules + index.ts) from `sillytavern-dev/st-core/src/`
- Runtime deps added: `arktype`, `crc`, `png-chunk-text`, `png-chunks-extract`
- Dev deps added: `oxlint@1.70.0`, `oxfmt@0.55.0`
- All deps installed via `nub install`
- Typecheck passes except 1 expected st-core error (see below)

## Commands

| Task | Command |
|---|---|
| Install deps | `nub install` |
| Add dev dep | `nub add -D <pkg>` |
| Add runtime dep | `nub add <pkg>` |
| Run script | `nub run dev` |
| Lint | `nubx oxlint src/` |
| Format | `nubx oxfmt src/` |
| Typecheck | `npx tsc --noEmit` |

## Known typecheck noise

- `src/lib/st-core/transform/regex.ts:161` — `'params' is declared but its value is never read` (`noUnusedLocals`). Expected; st-core copied as-is. Do not fix unless asked.
- Pre-existing app errors in demo routes (missing `routeTree.gen.ts`, missing `#/components/ui/*`) are unrelated to st-core.

## Import convention preference

Use `@/*` (not `#/*`) for st-core imports. Both work via tsconfig paths, but `@/*` is the preferred convention.
