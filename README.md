# st-v2

TanStack Start rewrite of SillyTavern-style character chat. Single-character roleplay with branching swipes, lorebooks, and configurable generation presets.

## Stack

- TanStack Start (router + start), TanStack Query
- React 19, Vite 8, TypeScript 6
- Drizzle ORM + better-sqlite3 (SQLite, file `dev.db`)
- better-auth (email+password, tanstack-start cookies plugin)
- `@tanstack/ai*` packages (Anthropic/OpenAI/Gemini/Ollama adapters)
- arktype (runtime validators in st-core)
- pnpm 11.8, NubJS toolchain

## Quick start

```bash
nub install        # install deps
nub run dev        # dev server
nub run test       # vitest (135 tests, all green)
nub run migrate    # one-time: import legacy SillyTavern data from public/data/
nubx oxlint src/   # lint
npx tsc --noEmit   # typecheck (2 pre-existing errors, expected — see AGENTS.md)
```

## Project layout

```
src/
  routes/           # TanStack Router file-based routes
  components/       # React components (Header + ~56 shadcn ui/*)
  db/               # drizzle schema, repositories, in-memory test helpers
  server/           # session stub + createServerFn handlers
  hooks/            # TanStack Query hooks
  lib/
    st-core/        # copied SillyTavern core (do not edit)
    character/      # app-level: shared normalizeCardData
    chat/           # app-level: pipeline, preset, pre-process, context-builder
    auth.ts         # better-auth instance
  integrations/     # tanstack-query provider
scripts/migrate-data.ts   # legacy ST data importer
data/avatars/, data/personas/   # gitignored binary storage
```

## Where to find docs

- `AGENTS.md` — agent conventions (NubJS, TanStack Start, st-core, commands, known typecheck noise). Read first.
- `docs/handoff.md` — current state, architecture, locked decisions, schema, roadmap.

## Current state

Phases 0–2 + character detail + legacy migration + upload validation fix are done. **135/135 tests green.** Next: **Phase 3 (chats + messages)**, then presets, then personas.
