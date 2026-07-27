# Contributing

## Stack

- **Frontend:** React 19, TanStack Start (Router + Start), Vite 8, TypeScript 6
- **State:** TanStack Query, TanStack Store, zustand
- **Database:** Drizzle ORM + better-sqlite3 (SQLite)
- **Auth:** better-auth (email+password)
- **AI:** `@tanstack/ai*` — Anthropic, OpenAI, Gemini, Ollama adapters
- **UI:** shadcn/ui, Tailwind CSS v4
- **Package manager:** pnpm

## Setup

```bash
pnpm install
echo 'DATABASE_URL="dev.db"' > .env
echo 'BETTER_AUTH_SECRET="your-64-char-secret"' >> .env
echo 'ENCRYPTION_KEY="your-32-char-secret"' >> .env
pnpm run dev
```

Don't have pnpm? `npm install -g pnpm` or see [pnpm.io](https://pnpm.io/installation).

## Project layout

```
src/
  features/chat/          # Chat feature
    config/               # Settings resolution (provider, lorebook, persona)
    generation/           # AI orchestration, SSE streaming, impersonation
    tree/                 # Branching message tree, lock, active path
    ui/                   # Chat page components, hooks, pages, settings panels
  db/                     # Drizzle schema, repositories, test helpers
  server/
    fns/                  # createServerFn handlers
    services/             # Importers, model fetcher
    validators.ts         # ArkType input schemas
    session.ts            # Auth helpers (isAdmin)
  routes/
    c/                    # Chat routes (/c, /c/new, /c/$id)
    api/
      chat-generate.ts    # SSE streaming endpoint
      characters/$id/avatar.ts
      backgrounds/$id/image.ts
      personas/$id/icon.ts
    admin/, characters/, settings/, lorebooks/, demo/
  components/ui/          # shadcn/ui components
  hooks/                  # TanStack Query hooks
  lib/
    st-core/              # SillyTavern core libs (DO NOT EDIT — see below)
    markdown.ts           # Showdown + DOMPurify render pipeline
  features/logging/       # Structured logger
scripts/
  migrate-data.ts         # Legacy SillyTavern importer
  create-admin.ts         # Bootstrap admin user
```

## Architecture (5 groups)

```
UI (presentation) → Generation (AI calls) → Tree (structure) → Data (persistence)
                                     ↕
                               Config (settings)
```

- **Tree** — branching messages, lock, active path. Pure ops + I/O service. No AI awareness.
- **Lock** — generation mutex stored on root message `extra` field. Self-healing stale recovery (5 min).
- **Generation** — `prepareStream`/`finalizeStream`/`cancelStream`, impersonation, provider resolution, prompt assembly.
- **Config** — per-user defaults and per-chat overrides for provider, model, preset, lorebooks, persona, prompts.
- **UI** — pages (`/c`, `/c/new`, `/c/$id`), components (composer, message list, side panels, settings), hooks.

## st-core (`src/lib/st-core/`)

Copied from SillyTavern. **Do not edit without explicit permission.**

| Module | Contents |
|---|---|
| `shared/` | Types, token counter, event bus, ID generator, logger, validators |
| `character/` | V2 + V3 character cards, PNG read/write — **server-only** (uses `Buffer`) |
| `chat-tree/` | Branching chat tree data structures |
| `lorebook/` | Lorebook buffer, context builder, entry types |
| `context/` | Prompt assembly, collection management |
| `script/` | STscript parser/runtime |
| `transform/` | Text transformation macros, regex utilities |

Import with `@/*` (not `#/*`). st-core internal imports use `.js` extensions.

## TanStack Gotchas

- No client-only APIs (`window`, `localStorage`) inside `createServerFn` handlers.
- Server fns need `method: 'GET' | 'POST'` matching the operation.
- Validation in `.validator()` runs on the server — it's the primary input guard.
- Mutations: `await mutationFn({ data })` then `queryClient.invalidateQueries({ queryKey })`.
- API routes: `return new Response("...", { status })` directly — don't throw.
- `@tanstack/ai-react` nests factory `body` under `body.data` in the POST.
- `useAiChat` captures `connection` on first render — use refs for fresh values.

## Key docs

| Doc | What it covers |
|---|---|
| `docs/users.md` | Admin vs user roles, permissions, CLI admin creation |
| `docs/markdown.md` | Full rendering pipeline (showdown, DOMPurify, CSS scoping, morphdom streaming) |

## Commands

| Task | Command |
|---|---|---|
| Dev server | `pnpm run dev` |
| Run tests | `pnpm run test` |
| Lint | `pnpm run lint` |
| Format | `pnpm run format` |
| Typecheck | `pnpm exec tsc --noEmit` |
| DB generate | `pnpm run db:generate` |
| DB migrate | `pnpm run db:migrate` |
| DB push | `pnpm run db:push` |
| DB studio | `pnpm run db:studio` |

## Tests

412 tests across 23 files. All pass. Uses in-memory SQLite for integration tests. Run with `pnpm run test`.

## Known typecheck noise

Don't fix unless asked:

- `src/lib/st-core/transform/regex.ts:161` — `'params' declared but never read`
- `drizzle.config.ts:6` — `string | undefined` issue with `DATABASE_URL`

## Remaining todos

- [ ] Encrypt stored provider API keys at rest (currently plain text in `ai_providers.api_key`).

## Image rendering

### Data flow

```
DB stores "uploads/{type}/{uuid}.png" (storedPath)
        ↓
Component constructs URL: "/api/{entity}/{id}/{field}"
        ↓
<img src={url} onError={hideImgShowFallback} />
        ↓
Browser → GET /api/{entity}/{id}/{field}
        ↓
1. getSession() → 401 if unauth
2. repo.getXxx(user.id, params.id) → 404 if missing
3. diskPathFromStored(record.imagePath) → "data/uploads/{type}/{uuid}.png"
4. readFile(diskPath) → bytes
5. Response(bytes, { content-type: <from extension>, cache-control: "private, max-age=300" })
```

### API routes

| Route | DB field | User-scoped | File |
|---|---|---|---|
| `/api/characters/$id/avatar` | `character.imagePath` | Yes | `routes/api/characters/$id/avatar.ts` |
| `/api/backgrounds/$id/image` | `background.path` | No (global) | `routes/api/backgrounds/$id/image.ts` |
| `/api/personas/$id/icon` | `persona.iconPath` | Yes | `routes/api/personas/$id/icon.ts` |

### URL construction

**Components with direct record access** construct the URL inline:

```tsx
const src = record.imagePath ? `/api/characters/${record.id}/avatar` : null;
```

**Chat components** receive pre-built URL strings via props from `chat-page.tsx` (the central hub). No component ever calls a path-to-URL conversion function — URLs are always built at the data source.

### Fallback pattern

Every `<img>` must handle two states: **no path** (null src → placeholder) and **load error** (broken img → fallback).

```tsx
{src ? (
  <img
    src={src}
    alt={name}
    className="..."
    onError={(e) => {
      e.currentTarget.style.display = "none";
      e.currentTarget.nextElementSibling?.classList.remove("hidden");
    }}
  />
) : null}
<div className="hidden ..."><FallbackIcon /></div>
```

For Radix `Avatar`, the `<AvatarFallback>` handles the error state automatically — just pass the URL directly to `<AvatarImage src={...}>`.

### Server-side helpers (`src/server/uploads.ts`)

| Function | Purpose |
|---|---|
| `storedPathFromDiskComponents(subdir, filename)` | `"uploads/avatars/uuid.png"` |
| `diskPathFromStored(stored)` | `"data/uploads/avatars/uuid.png"` |
| `contentTypeForPath(storedPath)` | `"image/png"` / `"image/jpeg"` / `"image/webp"` |
| `ensureUploadsDirs()` | Creates `data/uploads/avatars/`, etc. |

### Custom (ephemeral) images

User-uploaded images in chat (via `CustomImagePanel`) bypass the API entirely — they're stored as Base64 data URIs in a Zustand store and rendered directly as `<img src={dataUrl}>`.
