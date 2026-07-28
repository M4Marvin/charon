# `/characters` — Library Browser Redesign

Full redesign of the characters index page from ~10-item grid to a search-first browser
for thousands of characters. Two-part plan: backend (data layer + queries) and frontend
(UI/UX from a designer's perspective).

---

## Part 1: Architecture

### 1.1 Why the current page breaks at scale

| Problem | Current code | Cost at ~5k characters |
|---|---|---|
| Fetches **everything** | `listCharacterCards` selects full rows — including the entire `data` JSON blob (description, lorebook, etc., often 10–50KB each) — then picks a few fields | ~50–250MB transferred + JSON re-serialized per page load |
| Client-side search/sort/tag-counts | `filterCharacters`, `sortCharacters`, `tagCounts` useMemo in `index.tsx:39-101` | Full scan + sort of 5k objects on every keystroke |
| No windowing | All matches rendered as cards with `<img>` avatars | 1000s of DOM subtrees + 1000s of avatar HTTP requests |
| No URL state | search/sort/tags in `useState` | No shareable views, back-button loses context |
| Tag filter | computed client-side from the full set | requires the full set |

Nothing else in the app paginates yet (chats/lorebooks lists use the same fetch-all
pattern), so this page sets the precedent.

Relevant facts from research:

- `@tanstack/react-virtual@^3.14.5` is installed but unused — available for grid windowing.
- `better-sqlite3` ships FTS5 and json1 (verified: SQLite 3.53.3).
- `useCharacters()` (the list hook) is used **only** by this page — safe to replace outright.
- All character writes funnel through `repoCreate`/`repoUpdate` (`seed.ts`, importer); the
  only out-of-band insert is `scripts/migrate-data.ts`.

### 1.2 Schema migration — denormalize searchable fields

Searchable fields currently live inside the `data` JSON blob. Add real columns so queries
avoid selecting or parsing the blob at all.

Add to `src/db/schema.ts` `characters` table:

```ts
creator:       text("creator").notNull().default(""),
creatorNotes:  text("creator_notes").notNull().default(""),
tags:          text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
```

Indexes:

```sql
CREATE INDEX characters_user_updated_idx ON characters (user_id, updated_at);
CREATE INDEX characters_user_name_idx    ON characters (user_id, name COLLATE NOCASE);
```

Backfill (appended to the drizzle-kit-generated migration):

```sql
UPDATE characters SET
  creator       = COALESCE(json_extract(data, '$.creator'), ''),
  creator_notes = COALESCE(json_extract(data, '$.creator_notes'), ''),
  tags          = COALESCE(json_extract(data, '$.tags'), '[]');
```

Migration is additive (columns with defaults), so existing DBs upgrade in place.

**Write-path consistency.** `creator`/`creatorNotes`/`tags` become projections of `data`.
Enforce at the two repo write-points with a `derivedColumns(data)` helper:

- `createCharacter` — derive from `input.data`.
- `updateCharacter` — when `patch.data` is present, derive and set in the same `UPDATE`.
- `scripts/migrate-data.ts:275` — set the new fields in its direct `db.insert(characters)`.
- `seed.ts` uses `repoCreate` — covered automatically.

### 1.3 Query design — offset pagination

**Offset-based pages** (`LIMIT 60 OFFSET n`), with a separate `SELECT count(*)` for the total.

Why offset over keyset:
- Uniform across all three sorts — including `chats-desc`, which sorts on a
  `count(chats.id)` aggregate. Keyset cursors on an aggregate are ugly; the clean fix
  (materialize `chat_count`) couples the chats repo to character writes.
- At 1000s of rows in local SQLite, `OFFSET` cost is negligible.
- Gives a real total (`1,247 characters`) and keeps the door open to numbered pages later.
- Drift when rows are added/deleted mid-scroll is negligible in a single-user local app.

**Search**: `LIKE '%q%'` (escape `%`/`_`/`\`) across `name`, `creator`, `creatorNotes`,
`tagline`. SQLite `LIKE` is ASCII case-insensitive. FTS5 is verified available but adds
trigger/rebuild complexity; not justified at this scale. Documented as upgrade path.

**Tag filter** (AND semantics, matching current UI) — one EXISTS subquery per tag:

```sql
EXISTS (SELECT 1 FROM json_each(characters.tags) WHERE json_each.value = ?)
```

**Tag counts** (for the popover) — single aggregate query:

```sql
SELECT json_each.value AS name, count(*) AS count
FROM characters, json_each(characters.tags)
WHERE user_id = ? GROUP BY json_each.value ORDER BY name;
```

**Page query** (selects only card columns, never `data`):

```ts
SELECT
  characters.id, name, spec, spec_version, image_path, tagline,
  created_at, updated_at, creator, creator_notes, tags,
  count(chats.id) AS chat_count
FROM characters
LEFT JOIN chats ON chats.character_id = characters.id
WHERE user_id = ? AND [search] AND [tags exist]
GROUP BY characters.id
ORDER BY [sort]
LIMIT ? OFFSET ?
```

### 1.4 Server / hook layer

**Repo** (`src/db/repositories/characters.ts`):

```ts
searchCharacterCards(userId, { q, tags, sort, limit, offset })
  → { items: CharacterCardItem[], total: number }

characterTagCounts(userId)
  → { name: string; count: number }[]
```

`listCharacterCards` is deleted (its only consumer was the list server fn).

**Server fns** (`src/server/fns/characters.ts`) — replace `listCharacters`:

```ts
searchCharacters    // GET, arktype-validated { q?, tags?, sort, offset, limit }
characterTagCounts  // GET
```

**Hooks** (`src/hooks/useCharacters.ts`):

```ts
useCharacterSearch(params)   // useInfiniteQuery, pageParam = offset
                             // placeholderData: keepPreviousData
useCharacterTagCounts()      // plain useQuery
```

Query keys nest under `["characters"]` so **all existing mutation hooks keep working**
unchanged — they already invalidate `["characters"]`.

---

## Part 2: UI/UX Design

### 2.1 Diagnosis (current pain points)

1. **No sense of scale or place.** The header subtitle ("Import and manage your character
   cards.") is filler; the page never tells you how many characters exist or match.
2. **Search is an afterthought.** A `max-w-sm` input competing in one row with tags + sort;
   filtering is invisible when it happens (no count, no pending state).
3. **Cards are too big and misaligned.** 3 lanes at 1200px, variable heights
   (creator-notes may be absent, tag row wraps) — ragged scanlines, ~4 cards per viewport.
   Fine for 10, hostile to 1000.
4. **Feedback is monophasic.** One full-page skeleton covers everything; filter changes and
   fetch-more are silent.
5. **Mobile is an overflow zone.** Toolbar row wraps/overflows, cards go 1-col, and the
   `MobileTabBar` (h-16 + safe-area) can cover the last row — no bottom padding.
6. **AA gaps.** Chip ✕ buttons are 14px (min 24×24 required); no live region announces
   result changes; `text-3` on `bg-surface` measures ~4.3:1 (4.5:1 required for small text).

### 2.2 Design system (page-level decisions)

No new CSS tokens — everything maps to the existing system in `src/styles.css`. This
section fixes the page-level density and type assignments.

| Concern | Decision |
|---|---|
| **Type** | Page title `text-display` (Fraunces). Card name `text-sm font-semibold`. Card meta `text-xs text-2`. Counts/hints `text-xs text-3 tabular-nums`. |
| **Spacing** | Grid gap `gap-3` (12px) — denser than today's `gap-4`. Toolbar `py-3`; chips row `pt-2`. |
| **Lanes** | `<640px: 2` · `640–1023: 3` · `1024–1279: 4` · `≥1280: 5` (container `max-w-[1200px]`; ~230px lanes at full width). |
| **Card geometry** | `aspect-[3/4]` image + **fixed 88px body** (name 20px · excerpt 2×16px · tag row 20px · paddings). Total height = `laneW × 4/3 + 88px` — deterministic, no measureElement needed. |
| **Radius / elevation** | Cards `rounded-xl` (14px), border `border-subtle`, hover → `shadow-lg` + `border-brand/40` + `motion-safe:scale-[1.02]` on image only. |
| **Sticky surfaces** | `bg-base/85 backdrop-blur-sm` (same language as `MobileTabBar`). |
| **Rule: text-3 on cards** | Banned. `text-3` measures ~4.3:1 on `bg-surface` — under AA for small text. Card meta uses `text-2` (~8:1). `text-3` reserved for the status line on `bg-base` (4.6:1 ✓) and decorative placeholders. |
| **States** | Five canonical components + one new sanctioned pattern: **inline fetch-more skeleton row** (grid-shaped `Skeleton`, not a new loader). |

### 2.3 Page overview

```
────────────────────────────────────────────────────────────────
Characters                                             [Import PNG]
────────────────────────────────────────────────────────────────  ← sticky (z-30)
[🔍 Search name, creator, notes…                    /] [Tags ▾] [Sort ▾]
[fantasy ×] [gm ×] [Clear all]   ← only when filters active
1,247 characters                  ← role="status" aria-live="polite"
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│ img │ │ img │ │ img │ │ img │ │ img │
│ 💬 4│ │     │ │ 💬 12│ │ 💬 1│ │     │
│─────│ │─────│ │─────│ │─────│ │─────│    ← virtualized grid
│Elara│ │Vek  │ │Nam e│ │Name │ │Name │       window scroller
│A …  │ │A …  │ │A …  │ │A …  │ │A …  │
│#tag │ │#tag │ │#tag │ │#tag │ │#tag │
└─────┘ └─────┘ └─────┘ └─────┘ └─────┘
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    ← fetch-more skeleton row
│ ═══ │ │ ═══ │ │ ═══ │ │ ═══ │ │ ═══ │
└─────┘ └─────┘ └─────┘ └─────┘ └─────┘
```

**Key behavior**: header scrolls away; the toolbar never leaves. At 1000s of items this
is the single highest-impact behavior — refinement is always one gesture away.

### 2.4 Toolbar interactions

**Search.** Controlled input, 250ms debounce → URL (`?q=`) + query refetch. `/` shortcut
focuses from anywhere (ignored when target is input/textarea/contenteditable or meta held).
`Esc` clears → blurs. A `/` kbd hint sits at the input's right edge (`text-3` bordered
chip, `hidden` on touch via `max-md:hidden`).

**Tags.** Same `TagFilterPopover` component, now fed by `useCharacterTagCounts()`.
Trigger shows badge count when active.

**Sort.** `ui/select` — Recently updated / Name A–Z / Most chats. Changing sort
resets to page 0 (new key → refetch from offset 0).

**Active chips row.** Only renders when `tags.length > 0`. Chips = `Badge` + ✕ with
**24px hit area** (`size-6 -m-1 p-1`). `Clear all` as ghost button. If chips overflow
the row, use `overflow-x-auto no-scrollbar scroll-fade-x` (utilities already in
`styles.css`).

**Refiltering state.** `placeholderData: keepPreviousData` — the old grid stays visible
at `opacity-60` (150ms transition) while the new page loads. No skeleton flash, no
layout jump — just a dim-and-replace.

### 2.5 Card anatomy

```
┌───────────────┐
│           (⋯) │  RowActionsMenu, top-right, 40px, unchanged
│    image      │  aspect-[3/4], object-cover
│ 💬 12         │  chat-count chip, bottom-left overlay, only count > 0
├───────────────┤
│ Elara Vance   │  1 line, truncate, text-sm font-semibold
│               │
│ A cartogra-   │
│ pher who…     │  2 lines, line-clamp-2 (fixed 2.5em; absent → blank space)
│               │
│ #fantasy +3   │  1 row, overflow hidden, "+n" surplus
└───────────────┘
```

**Chat-count chip** (`bg-base/70 backdrop-blur text-[10px]`, `MessagesSquare` icon).
This is the glanceable "characters I actually use" signal, and gives the *Most chats*
sort visible meaning. Data already in the payload.

**Hover**: `shadow-lg` + `border-brand/40` on the card; `motion-safe:scale-[1.02]`
on the image only.

**Accessibility**: `<img loading="lazy" decoding="async" width={laneW} height={laneW*4/3}>`
— lazy-loads, prevents CLS. `alt={name}`. Whole card is a real `Link` (no `role="link"`
wrappers, per banned-pattern rules). ⋯ menu is a positioned sibling button.

**Fallback**: missing/broken image → `bg-raised` + name initial (existing pattern).

### 2.6 Virtualized browsing

Window-scroll virtualizer: `useWindowVirtualizer({ count: ceil(items/lanes), estimateSize, overscan: 4 })`.

- `estimateSize` = computed from container width (ResizeObserver), no `measureElement`
  needed — card geometry is deterministic.
- Fetch-more trigger: when the **last virtual row** is the final row and
  `hasNextPage && !isFetching` → `fetchNextPage()`.
- Fetch-more skeleton: the *next* virtual row renders as a lane-count row of skeleton
  cards (same `Skeleton` component, grid-shaped).
- End of list: nothing. The count line at the top already told you the total.

### 2.7 The five states + one

| State | Design |
|---|---|
| **Initial load** | `SkeletonCardGrid` — lanes-aware (2/3/4/5), shape-matched (aspect block + 3 body lines), 12 rows' worth. |
| **Refiltering** | Old grid at `opacity-60`, count line shows previous value. No skeleton flash for sub-300ms refinements. |
| **Fetch-more** | Inline skeleton row (lane-count `Skeleton`s in a grid row). |
| **Empty library** | `EmptyState` (UserRoundCog, "No characters yet") + Import CTA (admin only). |
| **No matches** | `EmptyState` (Search icon, "Nothing matches **your search**") + "Clear filters" primary button. Replaces today's orphaned centered paragraph. |
| **Error** | `ErrorBanner` with `Retry` button (calls `refetch`); toolbar stays interactive so the user can loosen filters to clear the error state. |
| **Delete** | `ConfirmDialog` (unchanged copy), success `toast`, item exits the grid; total decrements live via cache invalidation. |

### 2.8 Mobile layout

- **2-row sticky toolbar**: row 1 = search (full width, no kbd hint); row 2 = horizontal
  chip scroller `[Tags▾] [Sort▾] [active chips…]` using `overflow-x-auto no-scrollbar
  scroll-fade-x` — the fade communicates overflow instead of a clipped chip.
- **2-lane grid** (never 1-col): ~6–8 characters per viewport vs. 1.5 today.
- **Bottom clearance**: page gets `pb-24` so the last row and fetch-more skeletons clear
  `MobileTabBar` (h-16 + `env(safe-area-inset-bottom)`).
- **Import action**: moves into the header as an icon button (`Plus`,
  `aria-label="Import character"`) to save the row.

### 2.9 Keyboard & accessibility

| Feature | Implementation |
|---|---|
| `/` focus search | Route-level `keydown`, ignored when target is form element or modifier held |
| `Esc` clear | Clears search → blurs input (two-press: first clear, second dismiss) |
| Live result count | `role="status" aria-live="polite"`, updates on every filter/server response change |
| Semantic grid | `role="list"` on container, `role="listitem"` on cards |
| Focus-ring | All interactive elements (`focus-ring` utility, 2px brand outline, 2px offset) |
| Touch targets | ≥24×24px on chip ✕, menu trigger; menu items ≥28px (existing `min-h-7`) |
| Contrast | `text-2` on card surfaces (≈8:1), `text-3` on `bg-base` only |
| Reduced motion | Hover zoom in `motion-safe:`, shimmer/animation wrapped in existing `@media` block |
| Image | `loading="lazy"`, explicit `width`/`height` on every `<img>` to prevent CLS |

---

## Part 3: Before → After (5 highest-impact)

1. **Loose row of controls → sticky search-first command bar.** Search expands to own
   the row, is debounced/server-driven/URL-shareable, has `/` shortcut, and an
   aria-live result count makes every refinement visible and announced.
2. **3 loose variable-height lanes → 4–5 dense fixed-geometry lanes.** ~2.5× more
   characters per viewport, perfectly aligned scanlines, and deterministic heights
   that make virtualization cheap and scrollbar-stable.
3. **One skeleton for everything → per-phase honesty.** Initial grid skeleton
   (shape-matched), dim-and-keep on refilter, inline skeleton row on fetch-more,
   distinct empty-library vs no-matches states. The user always knows which of the
   four loading realities they're in.
4. **Mobile overflow → designed small-screen layout.** Two-row sticky toolbar with
   `scroll-fade-x` chip scroller, persistent 2-lane grid, `pb-24` tab-bar clearance.
5. **Below-AA details → conformance pass.** Chip ✕ 14px → 24px, live-region result
   count, semantic list grid, card meta `text-3` → `text-2` (4.3:1 → ~8:1), and
   consistent `focus-ring` on every control.

---

## Part 4: Implementation checklist

| # | File | Change |
|---|---|---|
| 1 | `src/db/schema.ts` | Add `creator`, `creatorNotes`, `tags` columns + 2 indexes to `characters` |
| 2 | `drizzle/0016_*.sql` | `db:generate` → append backfill `UPDATE` |
| 3 | `src/db/repositories/characters.ts` | `deriveColumns(data)` helper; add `searchCharacterCards`, `characterTagCounts`; drop `listCharacterCards` |
| 4 | `src/server/fns/characters.ts` | Replace `listCharacters` with `searchCharacters` + `characterTagCounts` (arktype GET input) |
| 5 | `src/hooks/useCharacters.ts` | `useCharacters` → `useCharacterSearch` (infinite) + `useCharacterTagCounts` |
| 6 | `src/routes/characters/index.tsx` | Full rewrite: `validateSearch`, `SearchToolbar`, `ActiveFilterChips`, `CharacterGrid` (virtualized), `CharacterCard` (fixed geometry), `GridStatus`, all feedback states |
| 7 | `src/components/common/Skeletons.tsx` | `SkeletonCardGrid` accepts lanes-aware classes + body lines |
| 8 | `scripts/migrate-data.ts` | Set new columns in its direct insert |
| 9 | `src/db/__tests__/characters.repo.test.ts` | Cover search, tag AND filter, sort, offset, total, derive-on-write |

### Component tree for step 6

```
CharactersPage
├── PageHeader (title + Import action)
├── SearchToolbar (sticky)
│   ├── SearchInput (debounced, / shortcut, Esc clear)
│   ├── TagFilterPopover (existing, fed by server counts)
│   └── Select (sort)
├── ActiveFilterChips (when tags.length > 0)
│   └── Badge × n + Clear all
├── GridStatus (role="status", count line)
├── CharacterGrid (virtualizer)
│   ├── CharacterCard × n (per row)
│   └── Skeleton row (fetch-more)
├── EmptyState × 2 (no library, no matches)
├── ErrorBanner + Retry
├── SkeletonCardGrid (lanes-aware, shape-matched)
└── ConfirmDialog (delete)
```

### Unchanged files

All mutation hooks (`useDeleteCharacter`, `useUpdateCharacter`, `useUpdateCharacterData`,
`useImportCharacter`), detail page (`$id.tsx`), edit page (`$id_.edit.tsx`), import flow
(`new.tsx`), avatar API, importer service — zero changes; they invalidate `["characters"]`
which covers the new search keys.

---

## Part 5: Tradeoffs & future work

- **Offset over keyset** — simpler; revisit if this becomes multi-user/high-churn.
- **LIKE over FTS5** — plenty at 1000s of rows; FTS5 triggers on denormalized columns
  are trivial to add later now that the columns exist.
- **Infinite scroll over numbered pages** — better for visual browsing; the offset
  design keeps numbered pages possible without server changes.
- **Avatar weight** — full-size PNGs (1–5MB) served per card. Locally fine thanks to
  lazy loading + 5-min cache; follow-up: generate small WebP thumbnails at import
  (new `thumbPath` column) if scrolling feels heavy.
- **Reusable pattern** — `validateSearch` + `useInfiniteQuery` + `useWindowVirtualizer`
  established here applies directly when `/chat` outgrows fetch-all.

---

## Part 6: Code appendix — critical fragments

Each fragment targets a pattern that has no precedent in the codebase, marking the
exact API surface the implementer needs to match.

### 6.1 `validateSearch` (first use in the app)

TanStack Router v1 coerces raw `Record<string, unknown>` from the URL. Kept
simple — plain typeof guards, no validation library. Tags are comma-separated in
the URL; the route splits them.

```ts
// src/routes/characters/index.tsx

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/characters/")({
  validateSearch: (raw: Record<string, unknown>) => ({
    q: typeof raw.q === "string" ? raw.q : undefined,
    tags:
      raw.tags && typeof raw.tags === "string" && raw.tags.length > 0
        ? raw.tags.split(",").filter(Boolean)
        : undefined,
    sort:
      raw.sort === "name-asc" || raw.sort === "chats-desc"
        ? raw.sort
        : undefined,
  }),
  component: CharactersPage,
});
```

The page reads params from `Route.useSearch()` and writes them with:

```ts
navigate({ search: { q: debouncedQ, tags: tags.join(","), sort }, replace: true });
```

`replace: true` avoids flooding history on every keystroke.

### 6.2 Server-fn input validator (GET with comma-separated tags)

Arktype v2 syntax: `?` = optional, `> n` = min length. Tags arrive as a
comma-separated string (GET cannot carry native arrays), split on the server.

```ts
// src/server/fns/characters.ts (additions)

const SearchInput = type({
  q: "string?",
  tags: "string?",     // "fantasy,gm" — split server-side
  sort: "string?",
  offset: "string > 0",
  limit: "string > 0",
});

function validateSearchInput(data: unknown): {
  q?: string;
  tags?: string[];
  sort?: string;
  offset: number;
  limit: number;
} {
  const result = SearchInput(data);
  if (result instanceof type.errors) throw new Error("Invalid search input");
  return {
    q: result.q,
    tags: result.tags ? result.tags.split(",").filter(Boolean) : undefined,
    sort: result.sort,
    offset: Number(result.offset),
    limit: Number(result.limit),
  };
}

export const searchCharacters = createServerFn({ method: "GET" })
  .validator(validateSearchInput)
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return repoSearchCards(user.id, data);
  });

export const characterTagCounts = createServerFn({ method: "GET" }).handler(
  async () => {
    const { user } = await getSession();
    return repoTagCounts(user.id);
  },
);
```

### 6.3 Repo: `searchCharacterCards` (Drizzle + raw SQL)

Three novel patterns: LIKE escape helper, `json_each` EXISTS subqueries via
`sql` templates, and derived-column projection on write.

```ts
// src/db/repositories/characters.ts (additions)

import { and, count, desc, eq, sql } from "drizzle-orm";

export function derivedColumns(data: CharacterDataV2) {
  return {
    creator: data.creator ?? "",
    creatorNotes: data.creator_notes ?? "",
    tags: data.tags ?? [],
  } satisfies { creator: string; creatorNotes: string; tags: string[] };
}

function escapeLike(pattern: string): string {
  return pattern.replace(/[%_\\]/g, "\\$&");
}

export function searchCharacterCards(
  userId: string,
  opts: {
    q?: string;
    tags?: string[];
    sort?: string;
    offset: number;
    limit: number;
  },
  db: DB = defaultDb,
): { items: CharacterCardItem[]; total: number } {
  const conditions: ReturnType<typeof sql>[] = [eq(characters.userId, userId)];

  if (opts.q && opts.q.trim()) {
    const q = `%${escapeLike(opts.q.trim())}%`;
    conditions.push(
      sql`(${characters.name} LIKE ${q} ESCAPE '\\'
          OR ${characters.creator} LIKE ${q} ESCAPE '\\'
          OR ${characters.creatorNotes} LIKE ${q} ESCAPE '\\'
          OR ${characters.tagline} LIKE ${q} ESCAPE '\\')`,
    );
  }

  if (opts.tags && opts.tags.length > 0) {
    for (const tag of opts.tags) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM json_each(${characters.tags}) WHERE json_each.value = ${tag})`,
      );
    }
  }

  const where = and(...conditions) as ReturnType<typeof and>;

  // ── Count ──
  const totalRow = db
    .select({ count: count() })
    .from(characters)
    .where(where)
    .get();
  const total = totalRow?.count ?? 0;

  // ── Sort ──
  let orderBy;
  switch (opts.sort) {
    case "name-asc":
      orderBy = sql`${characters.name} COLLATE NOCASE ASC`;
      break;
    case "chats-desc":
      orderBy = desc(count(chats.id));
      break;
    default:
      // "updatedAt-desc" (default)
      orderBy = desc(characters.updatedAt);
  }

  // ── Page ──
  const rows = db
    .select({
      character: characters,
      chatCount: count(chats.id),
    })
    .from(characters)
    .leftJoin(chats, eq(chats.characterId, characters.id))
    .where(where)
    .groupBy(characters.id)
    .orderBy(orderBy)
    .limit(opts.limit)
    .offset(opts.offset)
    .all();

  const items: CharacterCardItem[] = rows.map((r) => ({
    id: r.character.id,
    name: r.character.name,
    spec: r.character.spec,
    specVersion: r.character.specVersion,
    imagePath: r.character.imagePath,
    tagline: r.character.tagline,
    createdAt: r.character.createdAt,
    updatedAt: r.character.updatedAt,
    tags: r.character.tags,
    creatorNotes: r.character.creatorNotes,
    creator: r.character.creator,
    chatCount: r.chatCount,
  }));

  return { items, total };
}
```

`createCharacter` / `updateCharacter` must call `derivedColumns`:

```ts
// In createCharacter (line ~104):
.values({
  // ... existing fields
  ...derivedColumns(input.data),
})

// In updateCharacter (line ~133):
const patch = { ...input };
if (patch.data) Object.assign(patch, derivedColumns(patch.data));
```

### 6.4 Hook: `useCharacterSearch` (useInfiniteQuery shape)

```ts
// src/hooks/useCharacters.ts (replaces useCharacters)

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { searchCharacters } from "@/server/fns/characters";

const PAGE_SIZE = 60;

export function useCharacterSearch(params: {
  q?: string;
  tags?: string[];
  sort?: "name-asc" | "chats-desc";
}) {
  return useInfiniteQuery({
    queryKey: characterKeys.search(params),
    queryFn: ({ pageParam }) =>
      searchCharacters({
        data: {
          q: params.q,
          tags: params.tags?.join(","), // comma-separated for GET transport
          sort: params.sort,
          offset: String(pageParam),
          limit: String(PAGE_SIZE),
        },
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
```

`keepPreviousData` is the key to the dim-don't-flash refilter: when query-key
changes (new search/tag), the previous pages stay visible until the new first
page arrives.

### 6.5 Virtualizer + infinite-query handshake

This is the trickiest piece — the point where the virtual row list and the
query's next-page trigger intersect. The pattern: compute `shouldFetch` in
render from the virtualizer's item list, then fire `fetchNextPage` in an effect
so it's not called during render.

```tsx
// Inside CharacterGrid component

import { useWindowVirtualizer } from "@tanstack/react-virtual";

function CharacterGrid({
  pages,
  total,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  lanes,
}: {
  pages: Array<{ items: CharacterCardItem[] }>;
  total: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  lanes: number;
}) {
  const items = useMemo(
    () => pages.flatMap((p) => p.items),
    [pages],
  );
  const rows = Math.ceil((items.length + (hasNextPage ? lanes : 0)) / lanes);

  const virtualizer = useWindowVirtualizer({
    count: rows,
    estimateSize: () => ROW_HEIGHT,
    overscan: 4,
    // ROW_HEIGHT computed from container width → lane width * 4/3 + 88 + gap
  });

  // ── Fetch-more trigger: last virtual row visible ──
  const virtualItems = virtualizer.getVirtualItems();
  const lastVirtualIndex =
    virtualItems.length > 0
      ? virtualItems[virtualItems.length - 1]!.index
      : -1;

  const shouldFetch =
    lastVirtualIndex >= Math.ceil(items.length / lanes) - 2; // trigger 2 rows before end

  useEffect(() => {
    if (shouldFetch && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [shouldFetch, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Render ──
  return (
    <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
      {virtualItems.map((virtualRow) => {
        const rowStart = virtualRow.index * lanes;

        // Skeleton row for fetch-more
        if (virtualRow.index >= Math.ceil(items.length / lanes)) {
          return (
            <div
              key={`skel-${virtualRow.index}`}
              style={{
                position: "absolute",
                top: virtualRow.start,
                height: virtualRow.size,
                left: 0,
                right: 0,
              }}
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${lanes}, 1fr)` }}
            >
              {Array.from({ length: lanes }).map((_, i) => (
                <Skeleton key={i} className="rounded-xl" />
              ))}
            </div>
          );
        }

        return (
          <div
            key={virtualRow.index}
            style={{
              position: "absolute",
              top: virtualRow.start,
              height: virtualRow.size,
              left: 0,
              right: 0,
            }}
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${lanes}, 1fr)` }}
          >
            {Array.from({ length: lanes }).map((_, i) => {
              const item = items[rowStart + i];
              if (!item) return <div key={i} />;
              return <CharacterCard key={item.id} character={item} />;
            })}
          </div>
        );
      })}
    </div>
  );
}
```

Notes on the virtualizer:
- The container must sit in the normal document flow (not position:fixed or
  inside an overflow-hidden ancestor), because `useWindowVirtualizer` scrolls
  the window.
- `ROW_HEIGHT` is a `useRef` updated by the `ResizeObserver` on the container —
  derived from measured container width ÷ lanes × (4/3) + 88 (body) + 12 (gap).
  It is the **deterministic estimate**, passed to `estimateSize`. No
  `measureElement` callback is needed.
- The fetch-more skeleton row is rendered as virtual rows beyond `items.length`.
  This is why `count` includes `+ (hasNextPage ? lanes : 0)` so the grid
  computes the extra skeleton row.

### 6.6 Edge cases

**Back-navigation scroll restoration.** TanStack Router v1 restores scroll
position on back-navigation automatically. For the virtualizer, this works
because:
1. `staleTime: 30_000` means cached pages are still in the React Query cache.
2. On mount, all pages render instantly from cache → total virtual height is
   correct immediately → the router's scroll restoration lands correctly.
3. If the cache is stale (cold page load >30s after leaving), the initial fetch
   returns only page 0 → the grid is short → scroll restoration snaps to 0.
   **Mitigation**: set `staleTime: 5 * 60_000` (5 minutes) instead. This is a
   local/dev-oriented app; aggressive caching is appropriate.

**Delete during scroll.** `useDeleteCharacter` invalidates `["characters"]`,
which triggers `useInfiniteQuery.refetch()` — all pages reload with the updated
total. If the user was on "page 8" and the deleted character was on "page 3,"
all subsequent pages shift. This is acceptable — the user sees the grid
re-settle. `placeholderData: keepPreviousData` prevents a flash to skeleton.

**Offset drift (add-delete race).** Extremely unlikely in a single-user local
app. If it occurs, the worst case is a duplicate or missing row at a page
boundary — self-corrects on the next filter change or scroll.

**Tags column after backfill.** `deriveColumns` uses `data.tags ?? []`, matching
the migration's `COALESCE(json_extract(data, '$.tags'), '[]')`. If `data.tags`
is missing or null → empty array → column set to `[]` (the Drizzle JSON mode
serializer handles the array). Consistent.

**`creatorNotes` truncation in the denormalized column.** `creator_notes` can be
very long (multi-KB). Denormalizing it duplicates storage. If total DB size
becomes a concern later, truncate the column to e.g. 500 chars:
`data.creator_notes?.slice(0, 500) ?? ""`. The full value remains in `data` for
the detail page. Not needed now — included as a note in the helper's comment
above the `slice` site.

**Tags parameter serialization.** The hook joins tags with `,` and the server fn
splits them. Tags never contain commas (tag names are plain strings), so no
escaping is needed. If tags could legally contain commas, switch to a POST
server fn with native JSON body.

**SkeletonCardGrid lanes.** Today the component hardcodes `sm:grid-cols-2`. It
must accept a `lanes` prop and apply responsive column classes:
`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`. This is the same
grid the page uses, so no duplication.

**Card height stability across lane counts.** The card body is fixed at 88px
regardless of lane width. The image height scales with lane width (3:4 aspect).
As the viewport crosses a breakpoint, lanes change → lane width changes → image
height changes → `ROW_HEIGHT` changes → the virtualizer re-measures. This works
smoothly because the `ResizeObserver` fires and feeds a new `estimateSize`
before the next render.
