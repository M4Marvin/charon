# Charon

TanStack Start rewrite of [SillyTavern](https://github.com/SillyTavern/SillyTavern) — single-character AI roleplay with branching swipe trees, lorebooks, character cards (V2/V3), and configurable generation presets.

## Stack

- **Frontend:** React 19, TanStack Start (Router + Start), Vite 8, TypeScript 6
- **State:** TanStack Query, TanStack Store, zustand
- **Database:** Drizzle ORM + better-sqlite3 (SQLite file `dev.db`)
- **Auth:** better-auth (email+password)
- **AI:** `@tanstack/ai*` packages — Anthropic, OpenAI, Gemini, Ollama adapters
- **UI:** shadcn/ui, Tailwind CSS v4
- **Core:** copied SillyTavern libraries at `src/lib/st-core/` (character cards, chat tree, lorebook, context builder, STscript, text transforms)
- **Package manager:** pnpm

## Quick start

```bash
# 1. Clone and install
pnpm install

# 2. Create .env (copy from .env.example or create manually)
echo 'DATABASE_URL="dev.db"' > .env
echo 'BETTER_AUTH_SECRET="your-64-char-secret"' >> .env

# 3. Run dev server
pnpm run dev           # → http://localhost:3000

# 4. (Optional) Import legacy SillyTavern data from public/data/
pnpm run migrate

# 5. Run tests
pnpm run test          # 412 tests across 23 files
```

## Docker

```bash
docker compose up -d   # builds image, runs on port 3000
```

Persists the SQLite database in a named volume (`v2app-data`). Sets `DATABASE_URL=/app/data/local.db` inside the container.

## Project layout

```
src/
  features/chat/           # Chat rebuild (branch-based, see architecture.md)
    tree/                  #   Phase 1-2: branching messages, active path, lock
    generation/            #   Phase 3: SSE streaming, impersonation, provider resolution
    config/                #   Phase 4: per-chat + per-user settings (pending)
    ui/                    #   Phase 5: new chat page, components, hooks (pending)
  db/                      # Drizzle schema, repositories, in-memory test helpers
  server/
    fns/                   # createServerFn handlers
    services/              # Character/lorebook importers, model fetcher
    validators.ts          # ArkType input schemas
    seed.ts                # Dev seed data
  routes/
    c/                     # New chat routes (/c, /c/new, /c/$id)
    demo/                  # Developer playgrounds (/demo/config, /demo/generation)
    api/                   # SSE endpoint (chat-generate)
    characters/, settings/ # Character detail, app settings
    admin/                 # Admin panel (users)
  components/ui/           # shadcn/ui components (~56)
  hooks/                   # TanStack Query hooks
  lib/
    st-core/               # SillyTavern core (do not edit — see AGENTS.md)
    chat/                  # Prompt assembly (buildChatPrompt), rows, pipeline
    character/             # normalizeV3ToV2
    auth.ts                # better-auth instance
    crypto.ts              # API key encryption
  features/logging/        # Structured logging module
scripts/
  migrate-data.ts          # Legacy SillyTavern data importer
  create-admin.ts          # Bootstrap admin user
data/                      # Gitignored binary storage (avatars, personas)
```

## Current state

| Phase | Module | Status |
|---|---|---|
| 1 | tree | Done (59 tests) |
| 2 | lock | Done (16 tests) |
| 3 | generation | Done (20 tests) |
| 4 | config | Not started |
| 5 | ui | Not started |

**412/412 tests passing** across 23 test files. Old chat page at `/chats/$id.tsx` is frozen — new UI rebuilds from scratch in Phase 5 using `features/chat/generation/fns.ts`.

## Commands

| Task | Command |
|---|---|
| Dev server | `pnpm run dev` |
| Run tests | `pnpm run test` |
| Legacy migration | `pnpm run migrate` |
| Lint | `pnpm run lint` |
| Format | `pnpm run format` |
| Typecheck | `pnpm exec tsc --noEmit` |
| DB schema gen | `pnpm run db:generate` |
| DB migrate | `pnpm run db:migrate` |
| DB push | `pnpm run db:push` |
| DB studio | `pnpm run db:studio` |

## Where to find docs

- `AGENTS.md` — agent conventions, st-core rules, known typecheck noise, commands. Read first.
- `docs/handoff.md` — current state, architecture, locked decisions, schema, generation API, cleanup log.
- `src/features/chat/architecture.md` — 5-group boundary split, data flow, import rules.
- `src/features/chat/tree.md` — tree module design, API, conventions.
- `src/features/chat/generation.md` — generation module design, streaming pipeline.
- `src/features/chat/roadmap.md` — build order for remaining modules.
