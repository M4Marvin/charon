# Characters UI Pages — Developer Handoff

Detailed documentation for the UI routes shipped in this session: `/characters` (list), `/characters/new` (import form), and `/api/characters/:id/avatar` (PNG byte stream). Also covers the shell (`__root.tsx`, `Header.tsx`) that wraps every page.

For the data-layer architecture (server fns, repos, schema) see `docs/handoff.md`. For the V2 import + legacy migration writeup see `docs/character-import.md`.

---

## Scope

| In scope | Out of scope |
|---|---|
| `/characters` (list view) | `/` (pipeline demo — original scaffold) |
| `/characters/new` (import form) | `/api/auth/$` (better-auth proxy) |
| `/api/characters/:id/avatar` (API route) | Login / sign-up flows (deferred — see Auth stub note) |
| `__root.tsx` + `Header.tsx` (shell) | Detail / edit / chat pages (Phase 3) |
| `useCharacters` hook + `characterKeys` query keys | Hooks for other entities (Phases 2/4/5) |

---

## Auth stub (current state)

`src/server/session.ts` is **temporarily a no-op**: `getSession()` and `tryGetSession()` always return a hardcoded `default-user` session, with no cookie check, no better-auth roundtrip. The auth machinery itself (`src/lib/auth.ts` — better-auth + drizzle adapter) is still wired but unused. Migration must have run once to create the `default-user` row in the `user` table; otherwise server fns will fail with FK violations on insert.

When real auth lands, restore the body of `getSession()` to:

```ts
const request = getRequest();
const result = await auth.api.getSession({ headers: request.headers });
if (!result) throw new Error("Unauthorized");
return result;
```

and re-add `import { auth } from "@/lib/auth"`. The function signatures, return type, and call sites stay the same.

**Implication for the rest of this doc:** the "auth error → 401" / "redirect to login" stories below are **aspirational** — they describe what should happen once real auth is wired. Today, every protected page just works because `getSession()` always succeeds.

---

## Conventions quick reference

These conventions apply to every page below.

**Import aliases.** App code uses `@/*` (mapped to `./src/*` in `tsconfig.json`). The shadcn-generated `src/components/ui/*.tsx` files internally use `#/lib/utils.ts` (the `cn()` helper); that's a scaffold artifact, untouched on purpose. New pages should follow the `@/*` convention.

**TanStack Query keys.** Colocated with hooks in `src/hooks/useCharacters.ts`:

```ts
export const characterKeys = {
  all: ["characters"] as const,
  list: () => [...characterKeys.all, "list"] as const,
  detail: (id: string) => [...characterKeys.all, "detail", id] as const,
};
```

Mutations that should refresh the list call `queryClient.invalidateQueries({ queryKey: characterKeys.all })` on success.

**Server fns.** Auth-checked, validate input, return `Promise<T>`. They throw on auth/DB errors; TanStack Query surfaces via `error`. For predictable user-input failures (validation, bad PNG), the import fn returns a discriminated `ImportResult` instead of throwing — see the import page section.

**API routes.** Pattern from `src/routes/api/characters/$id/avatar.ts`: catch and return `new Response("...", { status })` directly. Don't throw. The browser sends cookies automatically because TanStack Start carries the SSR request headers.

**shadcn components.** Inventory at `src/components/ui/`. The two pages below use `Button`, `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`. Layout/styling is tailwind v4; tokens like `text-foreground`, `text-muted-foreground`, `text-destructive` come from the theme.

---

## Shell — `src/routes/__root.tsx` + `src/components/Header.tsx`

### `__root.tsx`

- **What:** root route. Provides `QueryClient` to descendants via `createRootRouteWithContext<MyRouterContext>`. Mounts `<Header />`, `<TanstackQueryProvider>`, and devtools. Loads `src/styles.css?url` into the head.
- **Why:** the `QueryClient` instance is created per-request in `getContext()` (in `src/integrations/tanstack-query/root-provider.tsx`) and passed in via router context. Without this, hooks like `useQuery` can't find their client.
- **Notable:** `<TanStackDevtools>` is always mounted. In dev it shows two panels (Router + Query) in the bottom-right; in production builds it's still in the bundle but the panels may not render.

### `Header.tsx`

- **What:** sticky top nav with brand "st-v2" and two `<Link>` items: Home (`/`) and Characters (`/characters`).
- **Active state:** the active link gets `text-foreground` instead of `text-muted-foreground`. `Home` has `activeOptions={{ exact: true }}` (only matches `/`); `Characters` uses default (matches `/characters` and `/characters/*`).
- **Layout:** `sticky top-0 z-50`, `max-w-5xl` to match the list page's container width. Brand link on the left, nav on the right.

---

## Page: `/characters` — list view

**File:** `src/routes/characters/index.tsx`
**Component:** `CharactersPage`
**URL:** `/characters` (renders for exact path; nested `/characters/new` does NOT use this — it has its own route registration)

### Purpose

Renders a grid of character cards loaded from the DB, with a header containing the page title and an "Import PNG" button that links to `/characters/new`. Each card shows the avatar, name, spec, and a Delete button.

### Data flow

```
CharactersPage mount
  → useCharacters()                            [src/hooks/useCharacters.ts:18]
    → queryKey: ['characters', 'list']        (characterKeys.list())
    → queryFn: listCharacters()                [src/server/fns/characters.ts:68]
      → getSession() → user.id                  [src/server/session.ts:42]
      → repoList(user.id)                      [src/db/repositories/characters.ts:14]
        → db.select(...).from(characters).where(eq(userId)).all()
      → map to CharacterListItem[] (strips `data` field — slim list payload)
```

### Local state

None. Everything is derived from the `useCharacters()` query result.

### UI components used

- `Button` (shadcn) — "Import PNG" with `asChild` so it renders the `<Link>` from TanStack Router
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` — each character card

### Layout & responsiveness

- Container: `mx-auto max-w-5xl px-4 py-8` — matches Header's `max-w-5xl`
- Header row: `flex items-center justify-between`, title + description on left, "Import PNG" button on right
- Card grid: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` — 1 column on mobile, 2 on `sm`, 3 on `lg+`
- Avatar: `aspect-square w-full rounded-md object-cover` — square thumbnail, fills card width, `object-cover` for aspect-ratio preservation
- Avatar placeholder (when `imagePath == null`): `<div className="bg-muted mb-2 aspect-square w-full rounded-md" />` — same dimensions, muted background

### States

| State | Render |
|---|---|
| `isLoading` | `<p>Loading...</p>` (no spinner, no skeleton) |
| `error` | `<p className="text-destructive">Failed to load: {error.message}</p>` |
| `data == null \|\| data.length === 0` | A single `<Card>` with centered muted text: "No characters yet. Import a PNG character card to get started." |
| `data.length > 0` | Grid of `<Card>` per character |

### Interactions

- **"Import PNG"** → `<Link to="/characters/new">` (TanStack Router client-side navigation; no full page reload)
- **"Delete"** (per card) → `deleteMutation.mutate({ id: char.id })` — fire-and-forget; button `disabled` while `isPending` so user can't double-click

### Error surface

- **Query error** (server fn throws — e.g., FK violation, DB connection issue): rendered as red text under the page header.
- **Auth error** (would be 401 if real auth was wired — currently impossible because `getSession()` always returns the default user): today, this never happens; documented for future.
- **Delete mutation error**: **not currently rendered.** The button disables during `isPending`; on success, `invalidateQueries` triggers a refetch. If the mutation rejects (e.g., DB failure), the user sees nothing — the card simply stays in place because the list refetch happens via `onSuccess`, and the silent failure means no refresh. This is a known UX gap; see [Known UI gaps](#known-ui-gaps).

### Cross-page concerns

- The list query key `['characters', 'list']` is invalidated by `useImportCharacter` and `useDeleteCharacter` (both call `queryClient.invalidateQueries({ queryKey: characterKeys.all })` on success). After a successful import or delete, the list refetches.
- The `<img src={`/api/characters/${char.id}/avatar`}>` browser request includes the user's session cookie; the API route verifies ownership before returning PNG bytes. If the file is missing on disk (e.g., avatar was deleted manually), the API returns 404 and the image silently fails to load — the alt text renders.

### Known gaps for this page

1. **No delete confirmation.** `ON DELETE CASCADE` wipes chats + messages for that character; clicking Delete is irreversible. An `AlertDialog` from `src/components/ui/alert-dialog.tsx` is already in the shadcn inventory.
2. **Delete errors are silently lost.** `deleteMutation.error` is not rendered. Add an error display next to the card or use a toast (`sonner` is available).
3. **No pagination / search.** Acceptable for ≤ a few hundred cards; beyond that, add pagination or a virtualized grid.

---

## Page: `/characters/new` — import form

**File:** `src/routes/characters/new.tsx`
**Component:** `NewCharacterPage`
**URL:** `/characters/new`

### Purpose

Form to upload a V2 PNG character card. On submit, calls the `importCharacter` server fn with the PNG as base64, navigates to `/characters` on success, or surfaces the error inline.

### Data flow

```
User picks file
  → handleFileChange (local) sets `file` and clears prior errors

User clicks "Import"
  → handleSubmit (local)
    → fileToBase64(file)                          [src/hooks/useCharacters.ts:69]
      → reads file.arrayBuffer(), encodes char-by-char to base64
    → importMutation.mutateAsync({ pngBase64 })   [src/hooks/useCharacters.ts:33]
      → server fn importCharacter                [src/server/fns/characters.ts:82]
        → getSession() → user.id
        → Buffer.from(base64, 'base64') → Uint8Array
        → parseCharacterCard(bytes)              [src/lib/st-core/character/parser.ts]
        → validateCharacterCard(raw)             [src/lib/st-core/character/validators.ts:192]
        → mkdir + writeFile(data/avatars/<uuid>.png) on success
        → repoCreate({ id, userId, name, data, imagePath })
        → on DB failure: rm(imagePath)  // orphan cleanup
      → returns ImportResult (discriminated union: ok | error)
    → on result.ok:    navigate({ to: '/characters' })
    → on result.error.kind === 'validation': setFieldErrors(result.error.errors)
    → on other error:  setError(result.error.message)
```

### Local state

| State | Type | Purpose |
|---|---|---|
| `file` | `File \| null` | The selected PNG from the file input |
| `error` | `string \| null` | Single-line error message (invalid_png, save_failed, base64 decode) |
| `fieldErrors` | `ValidationError[]` | arktype field-level errors from validation failures |

`error` and `fieldErrors` are **mutually exclusive** — the form shows one or the other based on `result.error.kind`. They are cleared on every file change and on submit start.

### UI components used

- `Button` — "← Back" (ghost, `asChild` + `<Link>`), "Cancel" (ghost, `asChild` + `<Link>`), "Import" / "Importing..." (submit, native type=submit)
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` — single card wrapping the form

### Layout & responsiveness

- Container: `mx-auto max-w-2xl px-4 py-8` — narrower than the list (centered form)
- Back link at the top (above the card)
- File input is a styled native `<input type="file" accept="image/png">` (not wrapped in a shadcn `Input`) — see inline `className` in the source for the styling
- Form footer: Cancel (left, ghost) and Import (right, primary) — `flex justify-end gap-2`
- Error area between file input and footer

### States

| State | Render |
|---|---|
| Idle (no file) | Import button `disabled` |
| File selected, not submitting | Import button enabled |
| `isPending` | All inputs + buttons `disabled`; button text becomes "Importing..." |
| `error` set | Red `<p>` below file input |
| `fieldErrors.length > 0` | Red `<ul>` with each error as `field: message` (field shown in mono font) |
| `result.ok` (after async resolve) | `navigate({ to: '/characters' })` — page redirects before any re-render |

### Interactions

- **File input** — `onChange` calls `handleFileChange`: sets `file`, clears prior `error` and `fieldErrors`
- **"← Back"** (top, ghost) — `<Link to="/characters">`
- **"Cancel"** (footer, ghost) — `<Link to="/characters">` (same destination as Back)
- **"Import"** (footer, submit) — `onClick` triggers `handleSubmit`
- Form `<form onSubmit={handleSubmit}>` — also fires on Enter key when file input is focused

### Error surface

`importCharacter` server fn returns a discriminated `ImportResult` rather than throwing on predictable input failures. The form inspects `result.error.kind` and routes to the right state.

| `result.error.kind` | UI |
|---|---|
| `"invalid_png"` | Red `<p>` with `result.error.message` |
| `"validation"` | Red `<ul>` of `field: message` |
| `"save_failed"` | Red `<p>` with `result.error.message` |

**Auth error** (when real auth lands): `getSession()` throws. TanStack Query's `useMutation` exposes this via `mutation.error`. The form does **not** currently render `mutation.error` — it only inspects the resolved `result` from `mutateAsync`. This is a known gap; when real auth is wired, the form will appear stuck on "Importing..." if the user is unauthenticated, with no error message. **Fix:** add `if (importMutation.isError)` rendering.

### Cross-page concerns

- On success, `useImportCharacter.onSuccess` calls `invalidateQueries({ queryKey: characterKeys.all })`. The list page's query refetches; new character appears.
- The form's local state (`file`, `error`, `fieldErrors`) does NOT clear after success — but `navigate({ to: '/characters' })` unmounts the component, so it doesn't matter.
- After a failed import, the user stays on `/characters/new` with the file input still populated (`file` is not cleared on error). They can re-click Import with the same file (the server fn re-validates and re-fails with the same error) or pick a different file.

### Known gaps for this page

1. **Auth errors aren't rendered** (see "Error surface" above). Fix: add `importMutation.isError` rendering.
2. **No file size limit.** A 20 MB PNG is fully read into memory, char-by-char converted to base64 (O(N²) string concat, could blow the call stack on huge files — `btoa` of a 100 MB+ buffer throws `Maximum call stack`). The server fn also re-encodes the PNG bytes to disk. Both are unbounded.
3. **No upload progress.** The button text changes to "Importing..." but there's no progress bar for the base64 conversion or server roundtrip.
4. **Base64 encode is O(N²).** `fileToBase64` builds the binary string char-by-char with `+=`. For a 5 MB PNG this is fine (~80ms in modern browsers); for a 50 MB PNG, the call stack may overflow. Fix later: `FileReader.readAsDataURL` or streaming chunked encode.
5. **Form reuses the same `error`/`fieldErrors` regions.** Reloading the page resets them, but navigating away-and-back does too (TanStack Router unmounts on navigate). That's fine.

---

## API route: `/api/characters/:id/avatar`

**File:** `src/routes/api/characters/$id/avatar.ts`
**Handler:** `GET` only
**URL:** `/api/characters/:id/avatar` (any `:id`; mounted in route tree at `src/routeTree.gen.ts`)

### Purpose

Streams PNG bytes from `data/avatars/<id>.png` for `<img src>` embedding. Used by the list page for each character's avatar. Auth via cookies (browser auto-sends).

### Flow

```
GET /api/characters/<id>/avatar
  → getSession()                                      [src/server/session.ts:42]
    on throw → 401 "Unauthorized"
  → getCharacter(userId, params.id)                  [src/db/repositories/characters.ts:18]
    on throw → 404 "Not found"        (covers both "no such id" and "owned by another user")
  → character.imagePath == null → 404 "Not found"
  → readFile(character.imagePath)                    [node:fs/promises]
    on throw (ENOENT etc.) → 404 "Avatar file missing"
  → 200 with bytes + headers:
       content-type: image/png
       cache-control: private, max-age=300
```

The auth check is for the future — `getSession()` always returns the default user today, so the API is effectively open during the auth-stub period. Don't put it behind a public CDN before real auth is wired.

### Used by

`<img src={`/api/characters/${char.id}/avatar`} alt={char.name} />` in `CharactersPage` (`src/routes/characters/index.tsx:45`).

The browser sends cookies automatically. TanStack Start carries the SSR request headers (including `Cookie`) when the API route is invoked from a same-origin `<img src>` request.

### Error model

Unlike server fns (which throw and let TanStack Query surface), API routes **catch and return `Response` directly**. Status codes used:

| Code | When |
|---|---|
| 401 | No session (only relevant once real auth is wired) |
| 404 | Character not found / not owned by current user |
| 404 | `imagePath` is null |
| 404 | PNG file missing on disk |
| 200 | PNG bytes returned with `content-type: image/png` |

All error responses are plain text (e.g., `"Not found"`). No JSON, no auth challenge.

### Cross-page concerns

- After `useDeleteCharacter` succeeds, the avatar file is removed by the server fn (`fs.rm(imagePath)` in `src/server/fns/characters.ts:185`). The next list-view render refetches and the card disappears — so users don't see a broken image. The only way to see one is to navigate to `/api/characters/<id>/avatar` directly for a recently deleted character, which returns 404 with "Avatar file missing".
- `cache-control: private, max-age=300` is set so the browser caches per-session for 5 minutes. If a character is re-imported under the same UUID (currently impossible — re-import creates a new UUID) the cached image would be stale. Not a real concern.

---

## Known UI gaps

Consolidated list of follow-ups. Each row has a `Where` pointer to the page section that mentions it.

| Gap | Severity | Where | Suggested fix |
|---|---|---|---|
| No delete confirmation dialog | High — destructive, cascades to chats/messages | `/characters` | Wrap Delete in `AlertDialog`; require explicit confirm |
| Delete errors silently lost | Medium | `/characters` | Render `deleteMutation.error` next to card or use `sonner` toast |
| Import form doesn't render auth errors | Medium — silent stuck UI when real auth lands | `/characters/new` | Add `importMutation.isError` rendering with `mutation.error?.message` |
| No file size limit on import | Medium | `/characters/new` | Client-side check (`if (file.size > N_MB) setError(...)`) + server-side guard in `importCharacter` |
| `fileToBase64` is O(N²) and stack-risky for large files | Low — practical for ≤ 10 MB | `/characters/new` | Switch to `FileReader.readAsDataURL` or chunked base64 encode |
| No upload progress | Low | `/characters/new` | Use `XMLHttpRequest` with `progress` events, or stream chunks |
| No pagination / search on list | Low — fine for ≤ a few hundred cards | `/characters` | Add `Pagination` (shadcn `pagination.tsx`) or a virtualized grid |
| No success toast on import or delete | Low | both | `sonner` is already in the shadcn inventory — wire `toast.success()` on mutation success |
| No character detail / edit page | High — only list + create + delete currently | (Phase 3) | Add `/characters/$id` route with avatar, full `Character` data, edit form |
| Auth is stubbed (default user) | Temporary | All protected routes | Restore the `auth.api.getSession` body in `getSession()`; see [Auth stub](#auth-stub-current-state) |

---

## File / directory reference

| Path | Purpose |
|---|---|
| `src/routes/__root.tsx` | Root route, providers, devtools |
| `src/routes/index.tsx` | Pipeline demo (out of scope for this doc) |
| `src/routes/characters/index.tsx` | `/characters` list view |
| `src/routes/characters/new.tsx` | `/characters/new` import form |
| `src/routes/api/auth/$.ts` | better-auth API proxy (out of scope) |
| `src/routes/api/characters/$id/avatar.ts` | `/api/characters/:id/avatar` GET handler |
| `src/components/Header.tsx` | Sticky top nav with active-link styling |
| `src/components/ui/*` | shadcn inventory — see `Button`, `Card`, `AlertDialog`, `Sonner` (toast) |
| `src/hooks/useCharacters.ts` | TanStack Query hooks + `characterKeys` + `fileToBase64` |
| `src/server/fns/characters.ts` | `listCharacters`, `getCharacter`, `importCharacter`, `updateCharacter`, `deleteCharacter` server fns |
| `src/server/session.ts` | `getSession()` / `tryGetSession()` — currently stubbed, see [Auth stub](#auth-stub-current-state) |
| `src/db/repositories/characters.ts` | Drizzle queries against the `characters` table |
| `src/db/__tests__/characters.repo.test.ts` | 15 tests covering create / get / list / update / delete + wrong-user |
| `data/avatars/<uuid>.png` | Character avatar PNGs, written by `importCharacter` and the legacy migration |

---

## See also

- `docs/handoff.md` — project state, decisions, schema, roadmap
- `docs/character-import.md` — V2 import + legacy migration writeup (server-fn-level detail, validation rules, normalization, edge cases)
