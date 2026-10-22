# Charon — UI/UX Target-State Specification

**Document status:** Normative target state. This describes the application **after every issue in the 22 October 2026 UI audit is fixed**. It is not a description of the current implementation.

**Owner:** Product & UI  
**Version:** 1.0  
**Source audit:** [`AUDIT.md`](../.review/ui-audit/AUDIT.md) — 58 consolidated findings (1 P0, 15 P1, 26 P2, 16 P3).  
**Companion evidence:** [`top-issues-contact.jpg`](../.review/ui-audit/top-issues-contact.jpg), [`shots/`](../.review/ui-audit/shots), [`agents/`](../.review/ui-audit/agents).

**Authority.** Where this document and the current code disagree, this document wins until it is deliberately amended. Any PR that changes a page, component, state, copy string, breakpoint, or token described here must update this document in the same PR. A change that cannot be expressed as a requirement and an acceptance test is not ready.

**How to use it.** Product/design: §1–§7. Engineering: §3–§6 and §14. QA/review: §9–§13. The closure matrix in §12 is the release checklist.

**Definitions.** *Must* = release-blocking. *Should* = expected unless a documented exception exists. *May* = optional. “Mobile” = `< 768px`; “tablet” = `768–1023px`; “desktop” = `≥ 1024px`; “wide” = `≥ 1440px`.

**Contents:** [1. Principles](#1-product-and-experience-principles) · [2. Definition of fixed](#2-definition-of-fixed) · [3. Design system](#3-design-system) · [4. Global shell](#4-global-shell-and-navigation) · [5. Canonical patterns](#5-canonical-patterns) · [6. Page specs](#6-page-specifications) · [7. Copy deck](#7-copy-deck) · [8. Accessibility](#8-accessibility-requirements) · [9. Keyboard](#9-keyboard-contract) · [10. State matrix](#10-state-coverage-matrix) · [11. QA matrix](#11-responsive-and-qa-matrix) · [12. Closure matrix](#12-audit-closure-matrix) · [13. Done](#13-definition-of-done) · [14. Implementation map](#14-implementation-map) · [15. Decisions](#15-decisions-and-assumptions)

---

## 1. Product and experience principles

Charon is a private, self-hosted, single-user roleplay and storytelling app. The interface should feel like a quiet reading room: dark, literary, calm, and out of the way. It is a tool for long-form reading and writing, not a dashboard.

These principles are binding:

1. **The story is the product.** Chat, character content, and lore are visually primary. Settings, metadata, and chrome recede.
2. **One primary action per surface.** Competing “Continue”, “Chat”, “New”, and “Choose” actions are not allowed in the same visual region.
3. **Never lose user work.** A form with unsaved edits either saves automatically with visible status, warns before leaving, or fails visibly and preserves the draft. Silent loss is a release blocker.
4. **Explain every state.** Every asynchronous surface has loading, empty, filtered-empty, error-with-recovery, and success feedback. No control is decorative. No page is a dead end.
5. **Mobile is not a smaller desktop.** Every core action is reachable at 320px, with 44px targets, readable labels, and no clipped or hidden primary controls.
6. **Consistency beats novelty.** Reuse the canonical page shell, header, state components, overlay contract, and control sizing. A one-off implementation is a defect unless this document specifies it.
7. **Accessible by construction.** WCAG 2.2 AA is the floor: names, headings, focus, contrast, touch, reduced motion, zoom, and keyboard paths are part of the design, not a later pass.
8. **Render content, not markup.** User-authored card text is converted to safe display text or sanitized rich text. Raw HTML, CSS, image syntax, and template tokens never appear in a list preview.
9. **Dark only, but not dim.** The palette is deep-ocean, but all readable text meets contrast requirements and all controls have visible states.
10. **The interface is finished.** No “Loading…”, “TODO”, placeholder art, dead buttons, fake controls, or unexplained technical errors ship.

---

## 2. Definition of “fixed”

The application is in the fixed state when all of the following are true:

- All 58 audit findings are closed, and the closure matrix in §12 maps every finding to a requirement and test.
- Every route in §6 is implemented at 320, 390, 768, 1024, and 1440px with no horizontal overflow.
- Every page has the canonical loading, true-empty, filtered-empty (where applicable), query-error-with-retry, mutation-error, destructive-confirm, and success states.
- Every interactive element is reachable by keyboard, has an accessible name, a visible focus indicator, and a mobile hit area of at least 44×44px (40×40px desktop).
- Every declared font file resolves; no synthetic 500/600/700 weights are used; no font 404s appear in the console.
- No list preview contains raw Markdown, HTML, CSS, image URLs, or `{{user}}` tokens.
- No page can trap the user without an in-app route back.
- The test suites in §11.4 pass, including visual regression at 320/390/1440 and the font/asset check.

---

## 3. Design system

### 3.1 Color

The palette is dark-first and token-driven. Raw hex values, `text-white`, `bg-white`, `bg-black`, and legacy `--sea-*`/`--lagoon` utilities are banned in app code. Use the semantic Tailwind utilities generated from these tokens.

| Token | Value | Use |
|---|---|---|
| `--bg-base` | `#0a1418` | Page background, app shell, transcript gutter |
| `--bg-surface` | `#111a24` | Cards, panels, list rows on base, input wells |
| `--bg-raised` | `#182635` | Popovers, menus, elevated cards, hover surfaces |
| `--bg-hover` | `#1f3041` | Hover/active row and control state |
| `--border-subtle` | `rgba(157, 178, 196, 0.12)` | Default 1px borders and dividers |
| `--text-1` | `#e8eff6` | Primary text, headings, message body |
| `--text-2` | `#9db2c4` | Secondary text, descriptions, metadata on raised/surface |
| `--text-3` | `#6b8093` | Captions only, on `--bg-base` only, at 11px or larger |
| `--brand` | `#2dd4bf` | Primary actions, links, focus |
| `--brand-strong` | `#5eead4` | Active nav text, emphasis, hover on links |
| `--danger` | `#f87171` | Destructive action text/icons and error accents |
| `--warning` | `#fbbf24` | Warning states, paired with icon/text |
| `--success` | `#34d399` | Success states, paired with icon/text |
| `--info` | `#60a5fa` | Informational states, paired with icon/text |
| `--primary-foreground` | `#06231f` | Text on brand-filled buttons |
| `--header-bg` | `rgba(10, 20, 24, 0.8)` | Sticky app/chat header over content |
| `--glass-bg` | `oklch(0.145 0 0 / 0.6)` | Static glass chrome |
| `--glass-bg-strong` | `oklch(0.145 0 0 / 0.8)` | Strong static glass chrome |

**Color rules**

- `--text-3` is a caption token, not body or metadata. On `--bg-surface`, `--bg-raised`, `--bg-hover`, popovers, or translucent glass, use `--text-2` instead. This rule closes the audit’s contrast failures in provider latency, preset parameters, the entry-sheet token counter, the `/` shortcut hint, and the composer placeholder.
- Status color is never the only signal. Pair it with an icon, a label, or a dot plus an accessible label.
- `--danger` is for destructive action and error text, not decoration. A destructive button uses a danger-tinted surface and danger text, or a solid danger fill with white text only when contrast is verified.
- Focus must not rely on a 30%-opacity ring. Use the `focus-ring` utility: 2px solid `--brand`, 2px offset, at least 3:1 against the adjacent surface.
- Every text/background pair must meet WCAG AA: 4.5:1 for normal text, 3:1 for large text and non-text UI. Any new token requires a documented contrast calculation.

### 3.2 Typography

**Files and delivery.** The app self-hosts Inter, Fraunces, and JetBrains Mono. It must ship the full declared set:

- Inter: 400, 500, 600, 700 — latin and latin-ext.
- Fraunces: 500, 600, 700 — latin and latin-ext.
- JetBrains Mono: 400, 500 — latin and latin-ext.

All `@font-face` URLs must resolve. `font-display: swap` is used; the display face is preloaded; `document.fonts.check()` returns true for every used weight. There are no Google Fonts or other CDN requests. CI must fail if any declared font URL is missing from `static/fonts/`.

**Type scale**

| Role | Size / line-height | Weight | Family | Use |
|---|---|---|---|---|
| Display desktop | 28 / 34 | 600 | Fraunces | Page H1 at `≥ 640px` |
| Display mobile | 24 / 32 | 600 | Fraunces | Page H1 below `640px` |
| Hero | `clamp(36px, 32px + 2.4vw, 72px)` / 1.02 | 600 | Fraunces | Landing H1 only |
| Title | 20 / 28 | 600 | Inter | Section H2 |
| Headline | 16 / 24 | 600 | Inter | Card, dialog, sheet titles; H3 |
| Body | 14 / 20 | 400 | Inter | Prose, form values, list descriptions |
| Small | 13 / 18 | 400/500 | Inter | Helper text, secondary rows |
| Caption | 11 / 16 | 500 | Inter | Metadata, counts, timestamps; minimum size |
| Mono | 12 / 18 | 400 | JetBrains Mono | URLs, IDs, token counts, code |
| Chat name | 14 / 20 | 600 | Inter | Visible conversation title; the page H1 is visually hidden |

**Rules**

- One H1 per page. It is always the page title, visually or `sr-only`. H2s are sections; H3s are cards/entries. Do not skip levels.
- No arbitrary sizes such as `text-[10px]`, `text-[21px]`, `text-[30px]`, or `text-5xl` in app chrome. Landing may use the hero token.
- Body copy is never smaller than 13px; captions never smaller than 11px. 10px is reserved for non-essential decorative glyphs and is not allowed for informative values.
- Serif is for page identity and the landing hero. Section, card, dialog, and sheet titles use Inter; do not let CardTitle drift back to a serif face while row titles are sans.
- The chat conversation may use a compact visible name, but the document still contains a visually hidden H1: “Conversation with {characterName}”.

### 3.3 Layout, containers, and breakpoints

**Breakpoints:** `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1440`. Always test at 320, 390, 768, 1024, 1440, plus 844×390 landscape and 320×568 short viewport.

**PageShell variants**

| Variant | Width | Padding | Used by |
|---|---|---|---|
| `wide` | `max-w-[1200px]` | `px-4 py-8 md:px-8` | Chats, Characters, Lorebooks, Character detail |
| `form` | `max-w-[768px]` | `px-4 py-8` | Character import, Lorebook new, Profile, Preferences |
| `settings` | `max-w-[1200px]` + 200px rail + content `max-w-[840px]` | `px-4 py-8 md:px-8` | Settings |
| `detail` | `max-w-[1200px]` | `px-4 py-6 md:px-8` | Character detail (page scroll, not inner pane) |
| `full` | `100dvh` | none | Chat conversation |
| `auth` | 45% / 55% split; form `max-w-[384px]` | `px-6 py-10` | Sign-in, Setup |
| `onboarding` | `max-w-[640px]` | `px-4 py-8` | Onboarding |
| `marketing` | `max-w-[1200px]`; hero copy `max-w-[720px]` | section rhythm | Landing |

**Spacing rhythm**

- 4px base unit. Page vertical padding 32px desktop / 24px mobile; section gap 24px (forms) or 40px (detail content).
- Card padding 16px; dialog body padding 24px; list row padding 12–16px; control gap 8px; action group gap 8–12px.
- A page must not mix independent `mb-6`, `space-y-6`, `space-y-10`, and `pt-2` without a documented reason. Use the shell’s section spacing.

**Responsive rules**

- `PageHeader` stacks below `sm` (640px): title and subtitle first, actions on the next row, `flex-wrap`.
- No primary action may be hidden behind a horizontal scroller. Section navigation becomes a labelled picker below `lg`.
- Sticky sub-bars sit at `top-14` (56px) below the app header; never `top-0` under a sticky header.
- Fixed bottom bars account for the 64px tab bar plus safe-area inset. Content gets matching bottom padding.
- No horizontal overflow at 320px. The only permitted horizontal scrollers are code blocks, tables with an explicit scroll cue, and the landing install tab strip; each must have a visible affordance.
- Body text line length stays between 45 and 75 characters; forms and reading columns are capped accordingly.

### 3.4 Surfaces, radius, elevation, glass

- Radius: controls 6–8px; cards/list rows 12px; panels/sheets 16px; dialogs 16–24px; pills full.
- Surfaces: base page; `bg-surface` for cards; `bg-raised` for popovers and elevated cards; `bg-hover` for hover.
- Borders: 1px `border-subtle`; no decorative multi-border stacks.
- Elevation: one soft shadow for popovers/dialogs; no heavy drop shadows on page cards. Cards use border + subtle hover, not floating.
- Glass (`glass`/`glass-strong`) is only for static chrome: header, composer shell, floating controls, side panels. Scrolling message rows use `message-glass`/`message-glass-strong` (no per-row backdrop filter).
- Transparent overlays must use semantic colors (`bg-base/70`, `bg-raised/90`), not `bg-black/40` or `text-white`.

### 3.5 Focus, touch, and pointer states

- Focus: `:focus-visible` shows a 2px solid `--brand` outline with 2px offset, or an equivalent verified ring ≥3:1. Never remove focus without replacement.
- Touch: every button, link, switch, tab, menu item, and input has a 44×44px minimum hit area on mobile and 40×40px on desktop. Visual glyphs may be smaller; the hit area may be expanded with a pseudo-element, but the accessible box must meet the target.
- Active press: controls respond with a subtle 1px translate or 0.98 scale and a color change, never a layout shift.
- Hover motion is gated by `@media (hover: hover) and (pointer: fine)`. Touch devices do not get hover-only reveals.
- Disabled controls remain readable, are removed from the tab order, and explain why they are disabled through adjacent copy or `aria-describedby` when the reason is not obvious.

### 3.6 Motion

- UI motion is 120–200ms; dialogs/sheets may use 200–300ms. Enter uses a strong ease-out (`cubic-bezier(0.23, 1, 0.32, 1)`); movement uses ease-in-out; hover/color uses ease. No `ease-in` for UI entry.
- Animate `transform`, `opacity`, and colors only. Do not animate `width`, `height`, `top`, or `all` for interaction feedback. Layout transitions (accordions) must use a measured height or grid trick.
- Never animate from `scale(0)`; start at 0.95–0.98 with opacity.
- Popovers scale from their trigger (`transform-origin: var(--transform-origin)`); modals stay centered.
- `prefers-reduced-motion: reduce` removes movement and long fades but keeps opacity/color changes that aid comprehension. Every custom motion wrapper has `motion-reduce:transition-none`.
- Keyboard-initiated actions (command palette, navigation) do not animate entry.
- The chat background fade is ≤200ms, not 700ms. Message entry is ≤180ms.
- Do not use mouse-position parallax in the character grid. If a decorative zoom is kept, it is CSS hover only, gated by pointer type and reduced motion.

### 3.7 Icons and imagery

- Lucide icons at 16/20px; icons inside labeled controls are `aria-hidden`. Icon-only controls have an accessible name and a 44px hit area.
- Avatars: `AvatarImage` + `AvatarFallback` initials; broken images fall back without an imperative `style.display` mutation.
- Content images: `OptimizedImage` with a surface preset and explicit fallback. Every image has a two-state contract: no source → placeholder; load error → fallback.
- A failed chat background falls back to the character avatar, then to the base gradient. It never leaves an empty dark band.
- Lightbox: the image fits the viewport (`max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] object-contain`), and Zoom either scales/pans or is hidden when the fitted image cannot grow. Mobile has an entry point from the chat header or portrait action.

### 3.8 Performance and layout stability

- Skeletons mirror the final geometry so content does not jump. Reserve image intrinsic dimensions (`width`/`height` or aspect ratio) and text line boxes.
- Character and chat images use `OptimizedImage` with the correct `sizes`/srcset; off-screen images lazy-load. Do not load full-resolution avatars for 48px rows.
- `backdrop-filter` is not used per scrolling message row. Use `message-glass`/`message-glass-strong` and keep blur on static chrome only.
- Search is debounced (200ms) on library pages; local list filtering is immediate. Avoid refetching on every keystroke.
- Prefetch only on intentional hover/focus; do not prefetch whole libraries.
- No mouse-position parallax or layout-triggering animations.
- A page should not shift more than a few pixels when its data arrives; if the final layout is unknown, use a skeleton with the same outer dimensions.

### 3.9 Content formatting

- **List previews** (character cards, chat rows, recent chats): use `plainExcerpt()`.
  - Strip `<style>`, `<script>`, all HTML tags, HTML entities, Markdown emphasis/strong/strikethrough, link and image syntax, code fences, headings, blockquote markers, and `{{...}}` template tokens.
  - Collapse whitespace, trim, and cap at a grapheme-safe length appropriate to the surface.
  - Do not cut inside a surrogate pair or leave an unmatched Markdown delimiter.
- **Detail content** (creator notes, character fields): sanitized Markdown via the established renderer. Raw HTML is sanitized; scripts/styles are removed.
- **Chat messages**: sanitized rich text, with code blocks and tables horizontally scrollable and clearly scrollable.
- **Card accessible names**: the link’s name is concise (`Open {name}` / `View {name}`), not the entire card body. Visual descendants may remain readable, but the link label must be explicit.
- **No CSS, HTML, or image URLs in text previews.** This is a release criterion, not a polish item.

---

## 4. Global shell and navigation

### 4.1 App header

The app header is present on all authenticated, non-immersive pages.

- Sticky at top, 56px high, `bg-background/80` or `--header-bg` with backdrop blur, 1px bottom border.
- Content: logo + “Charon” link to `/chat`; primary nav (Chats, Characters, Lorebooks); right side: visible Search button (desktop), New menu, account menu.
- Active nav item: `aria-current="page"`, brand text, 2px bottom indicator. Do not indicate active state by color alone.
- Search button opens the command palette; it shows `Ctrl K` on desktop. On mobile, a 44px search icon opens the same palette.
- New menu opens the **New sheet** (§4.3) with New chat, Import character, New lorebook.
- Account menu: Settings, Profile, Sign out. Signing out navigates to `/`.
- The header is hidden on `/`, `/signin`, `/setup`, `/onboarding`, and `/chat/<id>`.
- In an installed/standalone window, top chrome respects `env(safe-area-inset-top)`; bottom bars and the composer respect `env(safe-area-inset-bottom)`.
- A skip link (“Skip to content”) is the first focusable element on every shell page.

### 4.2 Mobile tab bar

Visible on authenticated, non-immersive pages below `md`.

- Fixed bottom, 64px + `env(safe-area-inset-bottom)`, `bg-popover/95`, top border, backdrop blur.
- Four items: Chats, Characters, a center **Create** control, Lorebooks.
- Each item is at least 44×44px, has an icon + label, and sets `aria-current="page"` when active.
- The center Create control opens the **New sheet**, not `/characters`. It has `aria-label="Create"` and a visible “New” label if space allows; it never duplicates the Characters tab.
- Content in the page wrapper gets `padding-bottom: calc(5rem + env(safe-area-inset-bottom))`; full-height pages account for it explicitly.
- The tab bar is hidden on `/chat/<id>`, where the composer owns the bottom edge.

### 4.3 New sheet

A single bottom sheet/dialog opened by the header New menu, the mobile center Create control, and the chat list’s empty-state CTA.

- Title: “New”.
- Actions, each 44px:
  - **New chat** — opens the character picker (`/characters` in chooser mode, or a searchable character sheet) and, on selection, creates/opens a chat.
  - **Import character** — navigates to `/characters/new`.
  - **New lorebook** — navigates to `/lorebooks/new`.
- Cancel closes; Escape closes; focus returns to the trigger.
- Do not duplicate this flow with a different destination elsewhere. “Choose a character” on the chat list opens this sheet.

### 4.4 Command palette

- Opens with `Ctrl/Cmd+K` or the header Search control (desktop and mobile).
- Centered top-third dialog, 448–560px wide, max height 70dvh, scrollable results.
- Search field autofocused; results grouped Navigate (Chats, Characters, Lorebooks, Settings) and Create (New chat, Import character, New lorebook).
- “Search characters” either focuses the characters search field after navigation or is renamed “Characters”. It must not promise a search it does not perform.
- Empty state: “No commands match ‘{query}’.” with a clear action.
- Escape closes, focus returns to the trigger, and the palette is fully keyboard operable.

### 4.5 Settings navigation

- Desktop (`≥ lg`): 200px vertical rail, sticky below the header, 44px items, icon optional, `aria-current="page"`.
- Mobile/tablet (`< lg`): a **section picker** button showing the active section, 44px high, opening a menu of all sections. Never use a hidden-scrollbar row that can hide the active item.
- Sections: Preferences, Profile, Defaults, Providers, Presets.
- Onboarding is **not** a settings section. A “Re-run setup” action lives on Profile (or a clearly separated Setup card) and returns to Settings.
- The nav is labelled “Settings sections” and uses the standard focus ring.

### 4.6 Section navigation (character edit)

- Desktop: 200px sticky rail below the header; active section visible; click scrolls smoothly (auto under reduced motion).
- Mobile/tablet: a labelled section picker with the current section, 44px high, opening all sections. It may be sticky below the header.
- The active section is derived from the topmost visible section and is always scrolled into view.
- No hidden horizontal chip scroller.

### 4.7 Authentication shell

- `/signin` and `/setup` do **not** render the global app header, mobile tab bar, or command palette.
- Layout: desktop 45% brand panel / 55% form; mobile single column with logo.
- Brand panel: wordmark and one-sentence description; not a heading unless it is the page H1 on mobile.
- Form column: max 384px, centered; one visible H1 (“Sign in to your account” / “Create your owner account”); 44px password reveal; 44px submit.
- No `min-h-svh` plus global header overflow. The page height is exactly the viewport minus browser chrome; no incidental vertical scrollbar.
- Authed users who visit `/signin` are redirected to `/chat`.
- When setup is complete, no “Sign up” link is shown. If credentials are lost, the page may state: “This install is already configured. If you’re locked out, reset the owner account from the server.” with no dead link.
- When setup is incomplete, the page may show “First time? Create the owner account” linking to `/setup`.

### 4.8 Onboarding shell

- Dedicated full-screen layout: centered logo, “Set up Charon” context, step indicator, content max 640px.
- No global header, tab bar, or command palette.
- If entered during first run: Back is disabled on step 1; a “Sign out” text action is available at the bottom.
- If entered from Settings as a re-run: a visible “Back to settings” control at the top and bottom; leaving with unsaved persona edits prompts to discard.
- The shell has one H1 (“Set up Charon”) and each step has an H2 (“Who are you?”, “You’re all set”).
- The primary action is sticky at the bottom of the viewport so it is always reachable.

### 4.9 Document titles

Set a per-route `<title>`. The format is `{Page} · Charon`, with dynamic names where cheap:

| Route | Title |
|---|---|
| `/` | `Charon — a private home for your AI characters` |
| `/signin` | `Sign in · Charon` |
| `/setup` | `Create owner account · Charon` |
| `/onboarding` | `Set up Charon · Charon` |
| `/chat` | `Chats · Charon` |
| `/chat/<id>` | `{chat title or character name} · Charon` |
| `/characters` | `Characters · Charon` |
| `/characters/new` | `Import character · Charon` |
| `/characters/<id>` | `{character name} · Charon` |
| `/characters/<id>/edit` | `Edit {character name} · Charon` |
| `/lorebooks` | `Lorebooks · Charon` |
| `/lorebooks/new` | `New lorebook · Charon` |
| `/lorebooks/<id>` | `{lorebook name} · Charon` |
| `/settings/preferences` | `Preferences · Settings · Charon` |
| `/settings/profile` | `Profile · Settings · Charon` |
| `/settings/defaults` | `AI defaults · Settings · Charon` |
| `/settings/providers` | `Providers · Settings · Charon` |
| `/settings/presets` | `Presets · Settings · Charon` |
| 404 | `Page not found · Charon` |

### 4.10 Toasts and live status

- Sonner is mounted once. Desktop: bottom-right. Mobile: top-center, below the header/safe area, so it never covers the tab bar or composer.
- Success, error, info, and warning toasts use the semantic icons and colors; errors persist long enough to read (≥6s) and are never the only error feedback on a form.
- Mutation errors use `toast.error` plus inline recovery where the form remains open. When an inline banner already states the same error, do not add a duplicate toast. Destructive confirms never rely on a toast as the sole confirmation.
- `role="status"`/`aria-live="polite"` is used for saving/saved counts and filters; `role="alert"` for blocking errors. Do not put a live region on every static row.

---

## 5. Canonical patterns

### 5.1 PageShell, PageHeader, and SectionHeader

`PageShell` provides the width, padding, and bottom clearance. `PageHeader` is the only page-title pattern. A `SectionHeader` is the only pattern for an H2 with a section-level primary action: H2 + optional description on the left, primary action on the right at `≥ sm`, stacked below at `< sm`.

```
PageHeader
  [Back 44]  [Title H1]                    [Actions]
             [Subtitle, max 2 lines]
```

- Root: `flex flex-col gap-3 sm:flex-row sm:items-start`.
- Title column: `flex-1 min-w-0`; H1 uses `text-display`; it must never shrink below its content or overlap actions.
- Subtitle: `text-2 text-sm`, clamped to two lines on mobile; hide or expand on demand if longer.
- Actions: `flex flex-wrap items-center gap-2 sm:shrink-0`. On mobile they sit below the title and may fill the row. Secondary actions go into a menu when space is tight.
- Back control: 44px mobile / 40px desktop, `aria-label="Back"`, returns to the logical parent. It is not repeated inside the content.
- PageHeader is used by every page except landing, auth, onboarding, and the immersive chat. Character detail uses it above the poster on mobile and at the top of the page on desktop.
- Error/loading/empty states keep the same PageHeader (or the page-specific shell) so the title and actions remain stable.

### 5.2 States

Every data surface implements these in order:

1. **Loading** — a skeleton that mirrors the final layout, `aria-busy="true"`, and an `sr-only` status. No “Loading…” text, spinner-only page, or layout shift to a different shape.
   - `SkeletonRows` for rows, `SkeletonCardGrid` for cards, `SkeletonForm` for forms, and a page-specific skeleton for the character poster/detail.
2. **True empty** — `EmptyState` with icon, title, one-sentence description, and one primary action. Page-level empty titles use `text-title` (20/28); empty states inside cards/panels use `text-headline` (16/24). Example: “No chats yet / Choose a character to start a conversation / Choose a character.”
3. **Filtered/search empty** — `EmptyState` naming the query/filter, with “Clear search” or “Show all”. Never reuse the true-empty copy.
4. **Query error** — `ErrorBanner` with friendly copy, the canonical retry action, and the page header/actions preserved. Never render an empty state on error. A deterministic not-found is a distinct state with a Back action, not a retry loop.
5. **Mutation error** — inline error in the form and `toast.error`; preserve all fields and the dialog. No silent failures.
6. **Destructive confirm** — `ConfirmDialog` naming the object and consequences; Cancel initially focused; pending label; focus return.
7. **Success** — toast or inline saved status, plus navigation where appropriate. A success must not leave the user on a deleted/missing page.

**Per-query independence.** A page with multiple queries (e.g., lorebook header + entries) renders each independently. An entries failure must not be disguised as “no entries”; the header remains, the entries area shows loading/error, and the count is only shown after success.

### 5.3 Lists, cards, and rows

- **Cards** (chats, characters, providers, presets): `bg-surface`, 1px border, 12px radius, 16px padding, hover border + subtle background. Titles `text-headline`, descriptions `text-2 text-sm`, captions `text-2` at 11–12px. No fixed body height that creates empty bands; content defines height, with clamped descriptions.
- **Character cards** use a 3:4 portrait, uniform lane width, body content of title + 2-line plain excerpt + creator + tags/meta. Tags show at most 3 + `+N`; metadata stays on one line (`{chats} · {relative time}`). Cards in the same row have equal width/height.
- **Chat cards** keep the 2-column desktop / 1-column mobile layout; title, relative time, 2-line plain preview, turn count, View character. The whole card has a concise link name; the menu is a sibling control.
- **Lorebook rows** are a relative container with an overlay link for the main area; the switch and menu are siblings, never nested inside the anchor. The switch has a 44px hit area.
- **Row actions** use `RowActionsMenu`, 40px desktop / 44px mobile, with a labelled trigger.
- **Tables** (embedded lorebook, raw stats) must either become stacked cards at `<sm` or have a visible horizontal-scroll cue and a sticky first column. Do not hide the content column.

### 5.4 Forms, validation, and saving

- Every field has a visible label, optional hint, and an error element with `aria-invalid`/`aria-describedby`.
- Required fields are marked; submit is disabled when required values are empty and the reason is visible. Validate on blur and submit; do not wait for a server round trip for obvious emptiness or format errors.
- All app forms use `noValidate`; the browser’s native validation bubble is never the primary error UI. Use the inline/FieldError contract on every platform.
- Textareas default to fixed sizing. Auto-grow is allowed only where specified and always has a max height (`max-h-60` for chat composer, `max-h-60` for persona, `max-h-72` for long-form fields) with internal scroll.
- A form with auto-save shows a single save status: Saving…, Saved, Couldn’t save + Retry. The idle label is calm (“Changes save automatically”) and is reserved in the layout so section titles do not jump.
- A form with explicit save has a persistent Save action (header and/or sticky bar), disabled until dirty, plus Discard. The Save action is reachable at every scroll position.
- **Unsaved-change protection:** route blockers, Back links, and `beforeunload` guard explicit-save forms. Closing a dialog/sheet with unsaved input prompts “Discard changes?”. Auto-save forms do not prompt.
- **Character edit specifically:** the form subscribes to `isDirty` reactively, Save is always mounted (disabled when clean), SaveBar sits above the mobile tab bar, and a successful save shows “Character saved” and navigates to the detail page. A failed save keeps the draft, shows an inline error and Retry, and does not navigate.
- Password change: show a reveal toggle (44px), inline validation, and copy “This will sign you out of all other devices.” with a success toast that repeats it.
- Provider/preset dialogs: disable the primary action until required fields are valid; show pending state; block double submits; invalidate test status after an edit.

### 5.5 Destructive confirmation

`ConfirmDialog` is the only destructive confirmation pattern (message deletion may use the same visual primitive as an alert dialog, but must share the contract).

- Title names the object: `Delete “{name}”?` or `Delete this message?`.
- Description states what is removed, including counts and branches where relevant; “This cannot be undone.”
- Destructive action uses danger styling; Cancel is initially focused; Escape closes; focus returns to the trigger.
- Pending state disables both actions and labels the destructive action “Deleting…”.
- On success, navigate away from a deleted entity (lorebook/character/chat) and toast.

### 5.6 Overlays (dialog and sheet)

One overlay contract, whether centered dialog or side sheet:

- `max-height: min(90dvh, 960px)`; mobile `calc(100dvh - 1rem)`.
- Header and footer are sticky; the body scrolls.
- Close control: 44px mobile / 40px desktop, top-right, with reserved header padding (`pr-14`) so title/description never run underneath.
- Header: dialog title 16/24 Inter 600; full-height sheet title 20/28 Inter 600; description 13/18 `text-2`; close.
- Footer: mobile column, Cancel above primary; desktop row, Cancel then primary, right-aligned. Primary is never above secondary on mobile.
- Initial focus: first field for create/edit; Cancel for destructive. Escape closes unless a nested confirm is open; focus returns to the trigger.
- A form overlay tracks dirty state and confirms discard; a successful submit closes and returns focus.
- Dialogs are used for centered create/edit/confirm flows; sheets for side panels (chat settings, lorebook entry editor) and full-height mobile flows. Both use the same close/footer/focus rules.

### 5.7 Images

- `OptimizedImage` is the only app-image entry point. Use the surface preset (`avatar`, `thumbnail`, `card`, `portrait`, `scene`, `background`, `lightbox`) so srcset and sizes match.
- Every image has an explicit fallback. Do not use imperative `style.display` to reveal fallbacks; key the image node by source and render the fallback on error.
- Character cards: 3:4 portrait, object-cover, fallback initial on `bg-raised`.
- Chat background: image → character avatar → gradient.
- Lightbox: fit-to-viewport; zoom works or is absent; mobile entry exists; Escape closes; focus returns.

### 5.8 Empty and error copy

- Friendly, specific, action-oriented. No raw browser errors (“Failed to fetch”), no “Error” as the only heading, no “Loading…”.
- Query error: “We couldn’t load {thing}. Check that the server is running and try again.” + Retry.
- Not found: “{Thing} not found. It may have been deleted or the link may be wrong.” + Back to list.
- Mutation error: “Couldn’t save {thing}. Your changes are still here. Try again.”
- Empty: “No {things} yet.” + one sentence + primary CTA.
- Filtered empty: “No {things} match ‘{query}’.” + Clear.
- Delete success: “{Thing} deleted.”
- Onboarding status error: “We couldn’t check your setup. Try again.”

### 5.9 Navigation and active state

- Active nav uses `aria-current="page"` plus a visual treatment (brand text + underline/rail). Never color alone.
- Back links always go to the logical parent, not browser history.
- No self-links (`/signin` → “Sign in” on `/signin`).
- No dead-end pages: every error/not-found state exposes Back to chats/list and, where useful, a primary recovery.
- Command palette and tab bar always have a touch entry.
- A page’s primary action is visible in the first viewport at 320, 390, 768, 1024, and 1440.

### 5.10 Responsive behavior rules

- At 320: one column, 16px gutters, 44px targets, no horizontal page scroll, no clipped labels. Primary action visible or sticky.
- At 390: same rules; two-column character grid; chat list one column.
- At 768: two/three-column grids; header nav hidden if it doesn’t fit; tab bar replaced by desktop nav only at `md` (768) if the full nav fits; otherwise keep tab bar and simplify header.
- At 1024: desktop header, settings rail, character detail two-column.
- At 1440: max 1200 content; no stretched single-column forms; management lists may use the full content width.
- At 200% zoom, layouts reflow to the mobile rules; dialogs scroll; no content is clipped or unreachable.
- Landscape 844×390: dialogs fit with scroll, tables scroll, primary actions visible.

---

## 6. Page specifications

### 6.1 Landing (`/`)

**Purpose.** Explain Charon, prove the product with screenshots, and install/sign in.

- Header: logo + wordmark; desktop nav (Tour, Features, Docs, GitHub, Sign in); mobile menu button (44) opening a sheet with the same links and Sign in. No global app chrome.
- Hero: H1 “A private home for your AI characters.”; supporting paragraph; primary CTA (“Install Charon” or “Create owner account” when setup is required); secondary “See what is different”; trust row.
- Install card: platform tabs (macOS & Linux, Windows, Docker), prerequisite, command, Copy (44), note, “Already installed? Sign in”.
- Sections: live product screenshots, branching explanation, feature grid, data/privacy, FAQ (accordion), final CTA, footer with Product/Docs/Project links.
- Document title: `Charon — a private home for your AI characters`.
- Accessibility: one H1, landmarks, accordion buttons with `aria-expanded`, copy button with an announced “Copied” status, mobile menu focus trap/return.
- Acceptance: at 320/390 no horizontal overflow; all nav links reachable on mobile; install tabs and Copy are 44px; no layout shift.

### 6.2 Sign-in and setup (`/signin`, `/setup`)

**Purpose.** Single-user authentication and first-run owner creation.

- AuthShell (§4.7); no global header/tab bar.
- Sign-in form: H1 “Sign in to your account”; username; password with 44px reveal; submit 44px; inline validation; server error banner (no duplicate toast); pending label.
- After sign-in: navigate to `/onboarding` if setup incomplete, else `/chat`.
- Setup: H1 “Create your owner account”; username, password, confirm; rules visible; inline validation; pending; on success route to onboarding. First-run only; if setup is complete, redirect to `/signin`. Server errors use the inline banner only.
- When setup is complete, `/signin` must not show a Sign up link; when incomplete, show “First time? Create the owner account.”
- Authed `/signin` redirects to `/chat`.
- No extra page scroll from header height.
- Document titles per §4.9.
- Acceptance: forms usable at 320 with 44px controls; no dead links; no wrap/overflow; focus and errors correct.

### 6.3 Onboarding (`/onboarding`)

**Purpose.** Get a first-run user to a usable chat: provider (if missing), persona, character (if missing), ready.

- Shell per §4.8. H1 “Set up Charon”; step indicator “Step N of M”; sticky primary action.
- Steps in order: Provider (only when missing), Persona, Character (only when missing), Ready. The step indicator and back/next behavior follow this filtered list.
- Step: Provider (only if missing).
  - Preset choices (models.dev presets) and a custom OpenAI-compatible endpoint; Name, Base URL, API key (or keyless local provider), optional model; Test connection with a success/failure result and Retry.
  - Required fields validate inline; the step cannot advance without a working provider; a local Ollama endpoint is allowed keyless. No skip while no provider exists.
- Step: Persona.
  - H2 “Who are you?”
  - Name (required if saving) and description (optional) with a capped auto-grow field (`max-h-60`).
  - Helper: “Characters use this name. You can change it later in Settings.” No duplicate paragraph and no “Next works too” contradiction.
  - Primary “Next” saves the persona (create/update + set default) and advances. It never silently no-ops. If save fails, stay on the step with an inline error and Retry.
  - Secondary “Skip for now” advances without saving; it is explicit about that.
- Step: Character (only if missing).
  - Import a PNG card or choose one of the available starters; the step requires at least one character; errors inline with Retry.
  - There is no “Continue without importing” bypass on an empty install; the user must import or choose a starter.
- Step: Ready: summary of provider/character; “Start chatting.”
- Status loading: skeleton, not text. Status error: full-page ErrorBanner + Retry; never an infinite “Loading your setup…”.
- Exit: first run offers Sign out; re-run from Settings offers Back to settings, with discard confirm if dirty.
- If entered from Settings, persona edits persist only through the explicit save/Next path; no silent loss.
- Document title: `Set up Charon · Charon`.
- Acceptance: Next advances without a hidden radio; primary action visible at 320; status error recoverable; no page requires an unbounded scroll before an action.

### 6.4 Chats

#### 6.4.1 Chat list (`/chat`)

- PageShell `wide`; PageHeader “Chats” with subtitle “{N} chats” and one primary CTA “Choose a character” that opens the New sheet (§4.3). On mobile, the header New menu and tab-bar Create open the same sheet; do not send users to a different destination from each trigger.
- Search: autofocus via `/`, clear with Escape/×, placeholder “Search title or character…”, 44px clear hit area. Filter by title or character name. Keyboard hints use 11px `text-2`, never 10px `text-3`.
- Counts: “29 chats” / “0 of 29 chats”; singular/plural.
- Groups: Previous 7 days / Previous 30 days / Older, with sticky day headers at `top-14` under the header.
- Cards: 2 columns ≥1024, 1 below; 92px+ row height; avatar, title, relative time, 2-line plain preview, turn count, View character; row menu Rename/Delete. Whole-card link has a concise name; menu is a sibling.
- States: skeleton, true empty with CTA, search empty with Clear search, query error + Retry. Rename dialog preserves input on failure; delete confirms with title/character/count.
- Document title: `Chats · Charon`.
- Acceptance: all five states; no duplicate/conflicting create destinations; 320/390 no overflow; 44px targets.

#### 6.4.2 Conversation (`/chat/<id>`)

- Full-bleed `100dvh`; no global header/tab bar. ChatHeader 56px: back 44, avatar, visible name 14/600 (H1 visually hidden “Conversation with {name}”), typing dots, settings 44. On `≥ xl`, portrait and scene toggles; below `xl`, a single “View” menu opens portrait/scene/lightbox as dialogs.
- Background: selected scene, then character avatar, then gradient. A failed image falls back in that chain.
- Transcript: max 48rem centered, 12px gutters; message bubbles use `message-glass`/`message-glass-strong`; role differentiation by border/name, not color alone. Body text `text-1`; assistant name brand; user name `text-2`.
- Message header: avatar + full/ellipsized name with a guaranteed min width; actions behind a single overflow menu on `< md` (Copy, Select for prompt, Rewrite, Edit, Delete) at 44px. On desktop, show the menu trigger and reveal secondary actions on hover/focus; no five permanent icons.
- Long content: code blocks and tables scroll inside the bubble with a visible scrollbar/fade; images are max-width 100%; the page itself never scrolls horizontally. `pre`/table text uses the mono/body scale and remains readable at 320.
- Message actions: Delete uses the shared destructive confirm and explains branch deletion; Copy announces “Copied”; edit is inline and Ctrl/Cmd+Enter saves, Escape cancels; swipe/regenerate controls remain.
- Message navigation: no floating controls over prose. Prev/next live in the header or a dedicated gutter; the jump-to-end button is 44px and hidden when at the bottom.
- Composer: glass shell; textarea 1–5 rows, max 120px; placeholder “Message {name}…” only; Enter sends, Shift+Enter newline, IME-safe; image/impersonate actions 44px; on `< sm`, secondary composer actions go into an overflow menu so the textarea keeps width; placeholder uses `text-2`.
- Empty conversation: `EmptyState` with character name and “Start the story by sending a message.”
- Loading: skeleton with a back control. Error: ErrorBanner + Retry + Back to chats. Not found: EmptyState “Chat not found” + Back to chats; no retry loop.
- Document title: chat title or character name + `· Charon`.
- Acceptance: deleted/missing chat has an in-app exit; 320 names readable; no overlap with nav; composer not taller than ~2 lines when empty; all controls 44px.

#### 6.4.3 Chat settings sheet

- Side sheet: 780px max on desktop, full-screen on mobile; header with avatar, visible title (20/28 Inter 600), subtitle, save status, close 44. Content max 34rem; sticky header/footer; one scroll region.
- Scope switch: This chat / Defaults, 44px. Section picker below `lg` (menu with all sections, active label fits at 320); vertical rail at `lg`.
- Sections: Character, Background, Chat details, Model & preset, Your persona, Lorebooks, Global prompts, Display.
- Save status: single polite live region; Saving/Saved/Couldn’t save + Retry; idle calm; no duplicate footers.
- Global prompts: textareas have visible Expand whenever content overflows; Expand opens a full-height editor; no control nested under an unrelated `inheritedValue` condition. Max height 360 with internal scroll.
- Background: scene selection, upload/clear custom image, “View scene” and “View portrait” accessible below `xl`; lightbox entry available.
- Destructive delete chat: names chat + message count; success navigates to `/chat`.
- Focus: opens to active section on desktop, close returns to gear; Escape closes; nested confirm doesn’t close the sheet.
- Mobile section picker labels never truncate; stack scope switch and picker at 320 if needed.
- Acceptance: all sections usable at 320; expand works; lightbox works; no focus loss.

### 6.5 Characters

#### 6.5.1 Library (`/characters`)

- PageShell `wide`; PageHeader “Characters” + primary “Import PNG” (text always visible, 44px) + subtitle count.
- Sticky search/filter block below the header (`top-14`, z below header) with search, tag filter, sort, selected tags, clear all; `/` focuses search, Escape clears; 44px controls.
- Grid: 2 columns at 320/390, 3 at 640, 4 at 1024, 5 at 1440; max 1200 content. 3:4 portraits; equal lane widths; body 96px; title 16/600 truncated to one line with title tooltip; excerpt `plainExcerpt` 2 lines; creator 11px `text-2`; tags max 3 + `+N`; meta one line (chats · updated). Row actions 40/44. Card link label “Open {name}”.
- Hover: border/brand tint + image scale 1.02 only on fine pointers; reduced motion disables.
- Infinite scroll: loading-more skeleton/spinner at the end; end marker “All {N} characters” when exhausted.
- States: `SkeletonCardGrid`, true empty `EmptyState` + Import, filtered-empty naming query + Clear filters, query error + Retry (never also render “No characters yet”).
- Import action and card image fallbacks.
- Document title: `Characters · Charon`.
- Acceptance: uniform cards; no raw HTML; 320 tags/meta not clipped; search visible while scrolled; import named.

#### 6.5.2 Import (`/characters/new`)

- PageShell `form`; PageHeader “Import Character” back to Characters.
- Dropzone: real `<button>`, 44px minimum, dashed border, upload icon, “Choose a PNG character card”, “V2 or V3 card. Max 50 MB. Drag & drop or click to browse.”; drag-over state; keyboard focus.
- File input hidden but labelled; PNG only; size/pixel limits; processing state with spinner and disabled dropzone; errors inline.
- Preview: stack vertically at `< sm` (image 3:4 thumbnail above metadata), two columns at `≥ sm`; image, name, creator, spec badges, description excerpt, tags (cap 3 + N), greetings/lorebook counts, warnings, duplicate notice.
- Actions: “Choose different file” (back to picker), “Cancel” (returns to Characters), “Import” (primary, pending, disabled while pending). Catch transport errors and show inline ErrorBanner + toast; preserve preview.
- Document title: `Import character · Charon`.
- Acceptance: preview readable at 320; errors handled; no duplicate cancel actions.

#### 6.5.3 Detail (`/characters/<id>`)

- PageShell `detail`; **page scroll** at all sizes (no independent right pane). Desktop: sticky poster column 340px + content. Mobile: compact PageHeader (back/title/actions) above poster; no fixed action bar.
- PageHeader: back 44, H1 character name (display), subtitle creator/updated/created, actions menu (Edit/Rename/Delete). On mobile the H1 is visible before the poster.
- Poster: 3:4 image, expand lightbox 44, chat count; primary “Start chat” when there is no chat, or “Continue chat” when one exists; secondary “New chat” in the actions menu. Use stable labels (do not inject the full name into the button; the name is in the header/poster). Stats chips; recent chats (max 5) with plain previews.
- Content: tags, Creator Notes (sanitized Markdown), Character Card accordions (Description/Personality/Scenario/Greetings/Example Messages) with token counts, embedded lorebook (stacked cards at `<sm`; table with scroll cue at `≥sm`), Details grid, More by creator.
- Rename opens a dialog with a Name field, required validation, pending state, and focus return; Delete confirms with the character name, chat count, and message count, then navigates to `/characters` on success. Both use inline error + toast on failure.
- Duplicate actions: exactly one primary chat action per viewport; no fixed “Continue/New” bar plus poster buttons.
- States: skeleton matching the poster/detail layout; query error + Retry; not-found with Back to Characters; image fallbacks.
- Lightbox: fit viewport, zoom/pan, Escape, focus return.
- Document title: `{name} · Charon`.
- Acceptance: title/back visible in first viewport at 320; last content scrolls clear of the tab bar; no duplicate CTAs.

#### 6.5.4 Edit (`/characters/<id>/edit`)

- PageShell `wide`; PageHeader “Edit {name}” with back and visible Save (disabled until dirty) at `≥ md`; a sticky SaveBar above the tab bar below `md`. Both surfaces share the same reactive dirty state. Form with desktop rail/mobile picker.
- Dirty state is reactive. The Save control is always mounted and disabled when clean; Discard is enabled when dirty. Save commits the form, shows “Character saved”, navigates to detail.
- Fields: Name (required), Tagline, Creator, Card Version; Description, Personality, Scenario, First Message, Alternate Greetings, Example Messages, System Prompt, Post-History Instructions, Creator Notes; Tags (ChipInput); Talkativeness slider; existing card data preserved.
- Textareas are capped (`max-h-72` with internal scroll) or auto-grow with a max; no page-length explosion.
- Errors: load error + Retry; not-found + Back; save error inline + toast, draft preserved, Retry; leave guard on Back/browser/logo with discard confirm.
- Section nav: desktop sticky rail; mobile section picker; active section always visible and correct.
- Mobile SaveBar: above tab bar (`bottom-[calc(4rem+env(safe-area-inset-bottom))]`, z above tab bar) or tab bar hidden on the edit route; content has matching bottom padding.
- Document title: `Edit {name} · Charon`.
- Acceptance: type → Save appears; click → mutation fires and persists after reload; Back while dirty prompts; no control hidden behind the tab bar.

### 6.6 Lorebooks

#### 6.6.1 Library (`/lorebooks`)

- PageShell `wide`; PageHeader “Lorebooks” + subtitle; actions Import (outline) and New Lorebook (primary), stacked below title at `< sm`; no overlap.
- Rows: relative container, overlay link for name/description, switch as sibling (44 hit area), count badge, chevron; no nested interactive elements; keyboard order link → switch → menu.
- Loading `SkeletonRows`; empty `EmptyState` + New Lorebook; query error + Retry and actions remain; toggle failures toast and revert.
- Document title: `Lorebooks · Charon`.
- Acceptance: 320 header/actions stack; switch focus visible; no dead end.

#### 6.6.2 New (`/lorebooks/new`)

- PageShell `form`; PageHeader “New Lorebook” back to Lorebooks; one Card with Name (required), Description (optional), and Create. Back is the only exit; do not duplicate it with a Cancel that performs the same navigation.
- `noValidate`; inline validation for required/whitespace name; `aria-invalid`/`aria-describedby`; pending disables fields and Create; success navigates to detail; error inline + toast.
- One exit: PageHeader Back. The card footer has Create; no duplicate Cancel link.
- Document title: `New lorebook · Charon`.
- Acceptance: no native validation bubble; H1 present; 320 fits.

#### 6.6.3 Detail (`/lorebooks/<id>`)

- PageShell `wide`; PageHeader with back, H1 lorebook name, description (clamped 2 lines), actions Edit lorebook and Delete; badges (entries, depth/scan) below the title at `< sm`, not competing with title.
- Toolbar:
  - `< sm`: two rows. Row 1: full-width search. Row 2: All/On/Off segmented filter, New Entry primary, overflow menu.
  - `≥ sm`: one row, search `min-w-0 flex-1` with a real minimum, filter, New Entry, menu.
  - All controls 40/44; menu stays inside the content column.
- Search filters `comment`, `key`, `keysecondary`, and `content` (case-insensitive, trimmed), composes with All/On/Off, shows a result count, and exposes a filtered-empty state with “Clear search”.
- Entries:
  - Loading: `SkeletonRows`; count badge hidden until success.
  - Error: ErrorBanner + Retry; header remains; never “No entries yet”.
  - True empty: EmptyState + New Entry.
  - Filtered empty: EmptyState naming the filter + Show all.
  - Row: title/comment (2 lines at `< sm`), keys, status dot with visible label at `≥ sm` and an `sr-only`/tooltip label at `< sm`; order hidden at `< sm` or moved into the menu; switch 44; overflow menu (Edit/Expand/Delete). Row click opens the editor. Expand has `aria-expanded`/`aria-controls` and removes the clamp. The All/On/Off group has `aria-label="Filter entries"`. Status dots are plain labelled text, not `role="status"` live regions on every row.
- Lorebook settings: an Edit lorebook dialog/sheet with Name, Description, Depth, Scan depth, Recursive; uses `useUpdateLorebook`; validation; save status; 44 controls.
- Delete: confirm names the lorebook; success navigates to `/lorebooks`.
- Entry editor: see §6.6.4. Import: see §6.6.5.
- Document title: `{name} · Charon`.
- Acceptance: search filters; entries states honest; 320 rows readable; config editable; delete navigates.

#### 6.6.4 Entry editor

- Side sheet (desktop 640–720; mobile full-screen) with header, sticky footer, scroll body.
- Header: “New Entry”/“Edit Entry”, description, close 44 with `pr-14` reserved.
- Fields: Comment, Keywords (ChipInput with visible input boundary + placeholder), Secondary keys, Content (required, capped auto-grow), Order, Constant switch, Disabled switch; token count uses `text-2`.
- Footer: mobile Cancel above Create; desktop row Cancel/Create; pending label; disabled while pending.
- Validation: content required; keyword or Constant required; inline FieldError; server error inline + toast; focus first field; dirty guard on close; focus return to New Entry/row menu.
- Acceptance: header not overlapped; footer consistent; unsaved close prompts; 320 usable.

#### 6.6.5 Import lorebook

- Dialog with title/description, dropzone or labelled file input (drag/drop supported), accepted JSON, file name/size, Import disabled until file, pending, errors inline, success toast with inserted/skipped counts; focus returns to Import.
- Copy: “The lorebook is created disabled — toggle it on from the list to activate.”
- Acceptance: focus return; 320 usable.

#### 6.6.6 Lorebook settings

- Dialog/sheet opened from detail; Name, Description, Depth, Scan depth, Recursive; save/cancel; validation; error/retry; 44. Uses the existing `useUpdateLorebook`.
- Acceptance: metadata and config editable; changes reflected in header.

### 6.7 Settings

#### 6.7.1 Shell (`/settings/*`)

- PageShell `settings`: PageHeader “Settings” with a **per-section subtitle**; desktop 200px rail + content max 840; mobile section picker.
- Sections: Preferences, Profile, Defaults, Providers, Presets. No Onboarding.
- Save-status slot: fixed height, aligned with the section title; present on auto-save sections only (Preferences, Defaults), with idle label “Changes save automatically.”
- Content width 840 for management lists; 672 for forms/reading is allowed, but Providers/Presets use the wider grid to avoid empty right space.
- Document titles per §4.9.
- Acceptance: active section always visible; section titles align; 320 usable.

#### 6.7.2 Preferences (`/settings/preferences`)

- H2 “Display preferences”; copy “These appearance options are saved in this browser.”
- SettingsCard with rows: Highlight dialogue, Auto-fix markdown, Block external media. Each row has label, description, switch 44, description association via `aria-describedby`; clicking row label toggles.
- Auto-save; status Saving/Saved; no explicit Save.
- Acceptance: switches keyboard/AT labelled; 320 fits.

#### 6.7.3 Profile (`/settings/profile`)

- H2 “Profile”; username card; Change Password card.
- Password form: Current, New, Confirm (all required); show/hide 44; hint “At least 8 characters”; inline errors; submit 44; pending.
- Setup card: “Re-run setup” opens onboarding with a back-to-settings path and discard guard; the first-run wizard is not a settings nav item.
- Disclose “This will sign you out of all other devices.”; success toast repeats it.
- Error banner for server error; no duplicate top-level “All fields required” if inline errors exist.
- Acceptance: inline errors, reveal, disclosure, 320.

#### 6.7.4 Defaults (`/settings/defaults`)

- H2 “AI defaults”; copy; save status.
- Provider select + Test (44; disabled without provider; pending; real error message), model combobox (search, refresh, clear), preset select; warnings for missing provider/default; no-provider callout with Add provider.
- Errors: load ErrorBanner + Retry; save error status + Retry; test result success/failure with icon/label.
- Acceptance: test error meaningful; save status; 320 controls 44.

#### 6.7.5 Providers (`/settings/providers`)

- SectionHeader: H2 “AI Providers”, description, primary “Add provider” on the right at `≥ sm` / full-width below at `< sm`. No 28px Add button below the list.
- Provider cards: name, Default badge, status dot with label (Untested/Testing/Connected/Error), base URL (wrap/tooltip), latency/models; menu (Edit, Test, Test message, Set default, Delete); default card tint.
- Loading `SkeletonRows`; true empty `EmptyState` + Add provider; error + Retry.
- Dialogs: Add/Edit provider with Name/Base URL/API key (required), Default model, headers JSON; validate; disable Create until valid; pending; unsaved guard; focus return.
- Test results invalidated on edit; “Connected” never survives a URL/key change.
- Setting a default provider when a model/preset is selected asks for confirmation and explains that the default model/preset will be cleared. Deleting the default provider warns about the same.
- Delete default warns about clearing default; confirm.
- Acceptance: no blank Create; no stale Connected; empty/loading canonical; 320/landscape dialog reachable.

#### 6.7.6 Presets (`/settings/presets`)

- SectionHeader: H2 “Presets”, description, primary “Add preset”; cards with name, Default badge, parameter summary in `text-2` 12px, menu (Edit, Duplicate, Set default, Delete).
- Loading `SkeletonRows`; empty `EmptyState`; error + Retry.
- Dialog: Name (required), Provider, Model, Temperature, Top P, Max tokens, Context size, Frequency penalty, Presence penalty; Create disabled until name; pending disables buttons and shows “Saving…” (no double submit); unsaved guard; focus return; dialog scrolls on short screens.
- Setting/deleting a default preset asks for confirmation and explains the effect on chats that inherit it. Delete default warns; confirm.
- Acceptance: no duplicate submits; dialog reachable at 320×568; text-3 not used for params.

#### 6.7.7 Settings overlay contract

- All create/edit dialogs use §5.6: max-height/scroll, sticky header/footer, 44px close, reserved header padding, Cancel above primary on mobile, focus return, dirty guard.
- Provider/preset dialogs must fit in 320×568, 390×667, 844×390, and 200% zoom.
- Acceptance: title/close/primary reachable in every tested viewport.

### 6.8 404 and root error

- 404: centered EmptyState, H1/H2 “Page not found”, explanation, primary “Back to chats”, secondary “Home”. If a header is visible, the page height is `calc(100dvh - 56px)`; no extra scroll.
- Root error: “Something went wrong”, friendly message (no stack), “Reload” and “Back to chats”; the error boundary keeps the shell and focus.
- Document title: `Page not found · Charon` / `Something went wrong · Charon`.
- Acceptance: no dead end; no 56px overflow; mobile tab bar visible or a clear path back.

---

## 7. Copy deck

### 7.1 Page titles and subtitles

| Page | H1 | Subtitle |
|---|---|---|
| Chats | Chats | “{N} chats” or “Choose a character to start a conversation.” |
| Characters | Characters | “{N} characters” / “Import and manage your character cards.” |
| Lorebooks | Lorebooks | “Manage lorebooks and their keyword-triggered entries.” |
| Settings | Settings | Per section: “Appearance options saved in this browser.” / “Your account and password.” / “Provider, model, and preset defaults.” / “OpenAI-compatible endpoints shared across chats.” / “Reusable generation parameters.” |
| Character detail | {name} | “@{creator} · Updated {relative} · Created {date}” |
| Character edit | Edit {name} | “Changes are saved when you choose Save.” |
| Lorebook detail | {name} | Description or “{N} entries · depth {d} · scan {s}” |

### 7.2 Empty states

- Chats: “No chats yet” / “Choose a character to start a conversation.” / “Choose a character.”
- Chat search: “No chats found” / “No chats match ‘{query}’.” / “Clear search.”
- Characters: “No characters yet” / “Import a PNG character card to get started.” / “Import PNG.”
- Character search: “Nothing matches your search” / “Try adjusting your search or filters.” / “Clear filters.”
- Lorebooks: “No lorebooks yet” / “Create one to start adding keyword-triggered entries.” / “New Lorebook.”
- Lorebook entries: “No entries yet” / “Add a keyword-triggered entry to this lorebook.” / “New Entry.”
- Lorebook filtered: “No entries match ‘{query}’.” / “Clear search.”
- Providers: “No providers yet” / “Connect an OpenAI-compatible endpoint to choose a model.” / “Add provider.”
- Presets: “No presets yet” / “Save generation parameters you reuse across chats.” / “Add preset.”
- 404: “Page not found” / “The page you’re looking for doesn’t exist.” / “Back to chats.”

### 7.3 Errors

- Load: “We couldn’t load {thing}. Check that the server is running and try again.” / “Retry.”
- Not found: “{Thing} not found.” / “It may have been deleted, or the link may be wrong.” / “Back to {list}.”
- Save: “Couldn’t save {thing}. Your changes are still here.” / “Retry.”
- Delete: “Couldn’t delete {thing}. Nothing was removed.” / “Retry.”
- Provider test: preserve cause: “Unauthorized — check your API key.” / “Couldn’t reach the endpoint. Check the URL and network.” / “Timed out after {n}s.”
- Onboarding status: “We couldn’t check your setup. Try again.” / “Retry.”
- Generic: never “Failed to fetch”, “Error”, “Something went wrong” alone.

### 7.4 Destructive copy

- `Delete “{name}”?`
- `This permanently deletes {the chat and all its messages / the character and its chats / the lorebook and all its entries / this entry}. This cannot be undone.`
- `Delete message? This removes this message and everything after it on this branch.`
- `Discard changes? Your unsaved edits will be lost.`
- `This will sign you out of all other devices.`

### 7.5 Tone rules

- Sentence case for labels, headings, and buttons.
- Second person, direct, calm. No exclamation marks.
- Say what happened, why, and the next action.
- Use the product’s nouns: chats, characters, lorebooks, entries, personas, providers, presets, scenes.
- Do not use “AI” as a synonym for provider/model. Use “provider” or “model.”
- Do not blame the user. Do not expose stack traces, HTTP status text, or raw SQL.

---

## 8. Accessibility requirements

The fixed app meets WCAG 2.2 AA and the following project requirements:

1. **Landmarks and headings:** one H1 per page; H2 sections; H3 cards/entries; header/nav/main/footer landmarks; settings nav labelled; skip link.
2. **Names:** every control has an accessible name. Icon-only buttons have `aria-label`; the mobile Import action is named; card links expose “Open {name}”, not the full body.
3. **Keyboard:** all controls reachable in logical order; no keyboard trap; Escape closes overlays; Tab cycles within dialogs; focus returns to the trigger; visible focus at ≥3:1.
4. **Touch:** 44×44 mobile and 40×40 desktop; switches have a 44px hit area; icon buttons are not smaller.
5. **Contrast:** 4.5:1 normal text; 3:1 large text and UI; `text-3` usage restricted to base captions; no white/black raw overlays.
6. **Forms:** labels, hints, errors, `aria-invalid`, `aria-describedby`; required markers; validation on blur/submit; errors announced.
7. **Status:** `aria-live` for save/filter status; `role="alert"` for blocking errors; no live region on every row.
8. **Images:** alt text for meaningful images, empty alt for decorative; fallbacks; no broken icon.
9. **Motion:** reduced motion respected; no essential information conveyed by motion; no auto-playing animation.
10. **Zoom/reflow:** 200% zoom works at 320 CSS px equivalent; no content loss or horizontal page scrolling; dialogs scroll.
11. **Color independence:** active/status/error states use icon/label/underline, not color alone.
12. **Screen reader:** test at least one desktop and one mobile flow; announce page titles, save status, filter results, and destructive consequences.

---

## 9. Keyboard contract

| Input | Action |
|---|---|
| `/` on a list page | Focus the page search field |
| `Escape` in a search field | Clear the query; focus stays in the field |
| `Ctrl/Cmd+K` | Open/close the command palette |
| `Escape` in an overlay | Close the overlay or the topmost nested confirm; restore focus |
| `Enter` in the composer | Send; `Shift+Enter` inserts a newline |
| `Ctrl/Cmd+Enter` in a message edit | Save the edit; `Escape` cancels |
| Arrow keys in the desktop settings rail | Move between sections; `Home`/`End` jump to ends |
| `Tab` in a dialog | Cycles within the dialog until closed |
| `Space`/`Enter` on a switch | Toggles it, without activating the surrounding row link |

## 10. State coverage matrix

Every route must satisfy the states below. “Required” means the state exists and is reachable/testable; “n/a” is only valid where the page has no such data.

| Route | Loading | True empty | Filtered empty | Query error + Retry | Mutation error | Destructive confirm | Success feedback | Not found |
|---|---|---|---|---|---|---|---|---|
| `/` | n/a | n/a | n/a | root error | n/a | n/a | install/copy | n/a |
| `/signin` | n/a | n/a | n/a | inline banner | inline banner | n/a | navigate | n/a |
| `/setup` | n/a | n/a | n/a | inline banner | inline banner | n/a | navigate | n/a |
| `/onboarding` | skeleton | step-specific | n/a | full-page Retry | inline + toast | discard on exit | navigate | n/a |
| `/chat` | grid skeleton | EmptyState | search EmptyState | banner + Retry | toast | ConfirmDialog | toast/navigate | n/a |
| `/chat/<id>` | chat skeleton | message EmptyState | n/a | banner + Retry + Back | toast | message/chat confirm | toast | EmptyState + Back |
| `/characters` | card skeleton | EmptyState | search EmptyState | banner + Retry | toast | ConfirmDialog | toast | n/a |
| `/characters/new` | spinner in dropzone | n/a | n/a | inline banner | inline + toast | n/a | toast + navigate | n/a |
| `/characters/<id>` | poster skeleton | n/a | n/a | banner + Retry | toast | ConfirmDialog | toast | EmptyState + Back |
| `/characters/<id>/edit` | form skeleton | n/a | n/a | banner + Retry | inline + toast + Retry | discard | toast + navigate | EmptyState + Back |
| `/lorebooks` | row skeleton | EmptyState | n/a | banner + Retry | toast | ConfirmDialog | toast | n/a |
| `/lorebooks/new` | n/a | n/a | n/a | n/a | inline + toast | n/a | navigate | n/a |
| `/lorebooks/<id>` | row skeleton | EmptyState | search EmptyState | banner + Retry | inline + toast | ConfirmDialog | toast/navigate | EmptyState + Back |
| `/settings/preferences` | n/a | n/a | n/a | n/a | n/a | n/a | Saved status | n/a |
| `/settings/profile` | session placeholder | n/a | n/a | n/a | inline banner | n/a | toast | n/a |
| `/settings/defaults` | SkeletonText | no-provider callout | n/a | banner + Retry | save status + Retry | provider switch | save status | n/a |
| `/settings/providers` | row skeleton | EmptyState | n/a | banner + Retry | toast | ConfirmDialog | toast | n/a |
| `/settings/presets` | row skeleton | EmptyState | n/a | banner + Retry | toast | ConfirmDialog | toast | n/a |
| 404 / root error | n/a | EmptyState | n/a | root error | n/a | n/a | retry/reload | EmptyState + Back |

**Rules for the matrix**

- A loading state must never render an empty message or a zero count.
- A failed entries/chats/characters query must not render the true-empty state.
- A filtered-empty state must name the query/filter and provide a reset.
- A not-found state must be distinct from a transient error and must not offer a futile Retry.
- A destructive success must navigate away from the deleted entity.

---

## 11. Responsive and QA matrix

### 11.1 Viewports

| Viewport | Purpose | Required checks |
|---|---|---|
| 1440×900 | Desktop wide | max width, 4–5 column grid, rails, dialogs, no stretched forms |
| 1280×800 | Small desktop | header, panels, dialogs |
| 1024×768 | Desktop threshold | two-column detail, settings rail, header nav |
| 768×1024 | Tablet | grids, stacked header, tab bar/section pickers |
| 390×844 | Common phone | 44px targets, one column, composer, dialogs |
| 320×844 | Minimum width | no overflow, no clipped labels, primary action visible, rows readable |
| 844×390 | Landscape phone | dialogs scroll, header/actions fit, no hidden primary |
| 320×568 | Short viewport | preset dialog, onboarding, entry sheet, imports |
| 200% zoom | Reflow | mobile layout, no content loss, dialogs scroll |

### 11.2 Automated gates

- `pnpm run lint`, `pnpm exec tsc --noEmit`, `pnpm run test`, `pnpm exec oxfmt --list-different src`.
- `pnpm run check:docs`.
- Font URL check: every `url()` in `fonts.css` exists in `static/fonts/`.
- Playwright visual suite: every route at 320/390/1440; snapshots reviewed.
- Axe/accessible-name assertions for every route; zero serious/critical violations.
- DOM assertions:
  - no `document.documentElement.scrollWidth > clientWidth` at 320.
  - every visible interactive element has an accessible name.
  - every visible interactive element is ≥44px on mobile (or has a documented hit-area exception).
  - every page has exactly one H1 (or a documented sr-only H1).
  - no `text-3` element on `bg-surface`/`bg-raised`/popover.
  - no `window.confirm`, native `<select>`, native checkbox.
- Build gate: no 404s for app assets in the production output.

### 11.3 Manual gates

- Keyboard-only pass through every route and overlay; focus never lost.
- Screen-reader pass for onboarding, character edit, lorebook detail, chat error, and a form dialog.
- Touch pass on a real phone for composer, message actions, tab bar, dialogs, and lorebook rows.
- Reduced-motion pass.
- 200% zoom pass.
- Light/dark: dark only; ensure OS theme does not invert the app.

### 11.4 Acceptance test catalog

| ID | Test |
|---|---|
| AC-01 | Type in character edit; Save becomes enabled and visible; click; reload shows the change. |
| AC-02 | Leave character edit while dirty; discard confirm appears; cancel stays, confirm leaves. |
| AC-03 | Onboarding step 1 at 320: Next advances without selecting a hidden radio; action is visible without scrolling through an unbounded field. |
| AC-04 | Abort onboarding status; error + Retry appears; retry recovers. |
| AC-05 | Open `/chat/does-not-exist`; Back to chats is present; no futile Retry loop. |
| AC-06 | Type in lorebook entry search; list filters; clear returns all; filtered-empty names the query. |
| AC-07 | Delay/abort entries query; skeleton/error appears; never “No entries yet”. |
| AC-08 | At 320, lorebook toolbar is two rows; search is usable; entry titles readable; controls ≥44. |
| AC-09 | At 320, PageHeader actions stack below the title; no overlap; subtitle readable. |
| AC-10 | At 320, settings and character-edit section pickers show the active section. |
| AC-11 | Character detail at 320: H1/back visible in first viewport; last content scrolls above tab bar; one CTA set. |
| AC-12 | Chat at 320: author names readable; message actions in one menu; no floating controls over prose; composer ≤2 lines empty. |
| AC-13 | Open every declared font; 0 404s; `document.fonts.check` true for 500/600/700. |
| AC-14 | Character cards show no raw HTML/Markdown; card link accessible name is concise. |
| AC-15 | Mobile import action has an accessible name and 44px hit area. |
| AC-16 | Preset dialog at 320×568: title, close, and Create/Cancel are reachable. |
| AC-17 | `/signin` after setup has no dead Sign up link; first-run shows a working setup path. |
| AC-18 | Characters search remains visible below the header after scrolling. |
| AC-19 | Every page has a distinct document title. |
| AC-20 | Every destructive confirm names the object; focus returns to trigger. |
| AC-21 | Every page has loading/empty/error states; no raw “Failed to fetch”. |
| AC-22 | 200% zoom: no horizontal page scroll; dialogs scroll. |
| AC-23 | Reduced motion: no transform-based motion; content remains usable. |
| AC-24 | Provider edit clears prior test result; blank Create disabled; double-submit blocked. |
| AC-25 | Password change discloses other-session sign-out; reveal toggle works. |
| AC-26 | Scene/portrait/lightbox reachable on mobile; lightbox zoom works or is hidden. |
| AC-27 | Settings mobile nav active item visible; no hidden sections. |
| AC-28 | Lorebook metadata/config editable and reflected in header. |
| AC-29 | Delete lorebook navigates to `/lorebooks` on success. |
| AC-30 | No page has horizontal overflow at 320; no clipped primary labels. |

---

## 12. Audit closure matrix

This matrix maps every audit finding to the fixed-state requirement and the verification. The section references are the authoritative behavior; the test IDs are in §11.4.

| Audit ID | Fixed-state requirement | Section | Verification |
|---|---|---|---|
| P0-1 | Character edit saves reliably, reactive dirty state, mobile bar above tab bar, leave guard | §5.4, §6.5.4 | AC-01, AC-02 |
| P1-1 | Onboarding Next saves/advances without hidden radio; textarea capped; sticky action | §6.3 | AC-03 |
| P1-2 | Onboarding status failure shows error + Retry, never infinite loader | §6.3, §5.2 | AC-04 |
| P1-3 | Chat loading/error/not-found has Back to chats and no futile loop | §6.4.2 | AC-05 |
| P1-4 | Lorebook search filters and has filtered-empty state | §6.6.3 | AC-06 |
| P1-5 | Entries loading/error are distinct from true empty; retry | §6.6.3, §5.2 | AC-07 |
| P1-6 | Lorebook detail 320 toolbar stacks; rows readable; controls 44 | §6.6.3 | AC-08 |
| P1-7 | PageHeader stacks; settings and character-edit navs show active section | §4.5, §4.6, §5.1 | AC-09, AC-10 |
| P1-8 | Character detail mobile header first, one CTA set, content clears bars | §6.5.3 | AC-11 |
| P1-9 | Chat author names readable; actions in overflow menu at mobile | §6.4.2 | AC-12 |
| P1-10 | All font files resolve; no synthetic weights | §3.2 | AC-13 |
| P1-11 | Previews strip markup; card link name concise | §3.9, §6.5.1 | AC-14 |
| P1-12 | Mobile import named and ≥44 | §6.5.1 | AC-15 |
| P1-13 | Dialogs/sheets scroll; title/close/actions reachable at short/zoom | §5.6 | AC-16, AC-22 |
| P1-14 | No dead Sign up after setup; first-run path works | §4.7, §6.2 | AC-17 |
| P1-15 | Characters search sticky below header, usable while scrolled | §6.5.1 | AC-18 |
| P2-1 | Character grid: 3:4, uniform lanes, equal heights, no clipping | §6.5.1 | AC-14, AC-30 |
| P2-2 | Long names do not clip primary CTA; stable label | §6.5.3 | AC-11 |
| P2-3 | Character detail page scrolls as a whole; poster sticky, no inert pane | §6.5.3 | AC-11 |
| P2-4 | List error never shows empty; detail/edit errors have Retry | §5.2, §6.5 | AC-21 |
| P2-5 | Import transport failures caught and surfaced; preview preserved | §6.5.2 | AC-21 |
| P2-6 | Chat composer short placeholder, capped height; floating nav no overlap | §6.4.2 | AC-12 |
| P2-7 | Switch focus visible; Expand state/clamp; row click | §6.6.3 | AC-08 |
| P2-8 | Lorebook empty/error states canonical; actions preserved; retry | §6.6.3, §5.2 | AC-07, AC-21 |
| P2-9 | Toggle failures toast and revert | §6.6.1, §6.6.3 | AC-21 |
| P2-10 | Entry sheet header/footer/focus; import dialog focus return | §5.6, §6.6.4 | AC-16, AC-20 |
| P2-11 | New lorebook H1/noValidate/one exit; lorebook metadata editable | §6.6.2, §6.6.6 | AC-28 |
| P2-12 | Settings content width and aligned save-status slot | §6.7.1 | AC-27 |
| P2-13 | Settings skeleton/empty canonical | §5.2, §6.7.5/6 | AC-21 |
| P2-14 | Provider validation/pending; preset double-submit guard; test invalidation; real error | §6.7.5, §6.7.6 | AC-24 |
| P2-15 | Password disclosure/reveal/inline errors | §6.7.3 | AC-25 |
| P2-16 | Scene/portrait/lightbox reachable on mobile; zoom works | §3.7, §6.4.2/3 | AC-26 |
| P2-17 | Auth/404 no extra scroll; authed signin redirect; shell consistent | §4.7, §6.8 | AC-17, AC-30 |
| P2-18 | One New flow; palette touch entry; tab bar not duplicate | §4.2–4.4 | AC-30 |
| P2-19 | All touch targets 40/44 | §3.5 | AC-08, AC-12, AC-15 |
| P2-20 | One focus ring; dialogs return focus; switch focus visible | §3.5, §5.6 | AC-20 |
| P2-21 | text-3 restrictions; composer placeholder text-2; metadata ≥11px | §3.1, §3.2 | AC-13, AC-21 |
| P2-22 | Heading/title scale consistent; one H1 per page | §3.2, §5.1 | AC-09 |
| P2-23 | One overlay header/footer/close contract | §5.6 | AC-16 |
| P2-24 | Per-section Settings subtitle; Onboarding removed/relocated with return path | §4.5, §6.7.1, §6.3 | AC-27 |
| P2-25 | PageShell containers/rhythm unified | §3.3, §5.1 | AC-30 |
| P2-26 | Global prompts Expand; lightbox fit/zoom; picker labels fit 320 | §6.4.3 | AC-26 |
| P3-1 | No one-off loaders/empty texts; canonical states | §5.2 | AC-21 |
| P3-2 | Per-route document titles | §4.9 | AC-19 |
| P3-3 | Motion standard/reduced motion | §3.6 | AC-23 |
| P3-4 | No raw white/black/legacy palette | §3.1 | AC-21 |
| P3-5 | 404/root error recovery CTAs | §6.8 | AC-05, AC-21 |
| P3-6 | Character grid loading-more/end state | §6.5.1 | AC-30 |
| P3-7 | Dialog/sheet unsaved guards; entry sheet persists/drafts | §5.4, §5.6 | AC-02, AC-16 |
| P3-8 | Lorebook filter labelled; row status not live spam; confirm names object | §5.5, §6.6.3 | AC-20 |
| P3-9 | Embedded lorebook responsive cards/scroll cue | §6.5.3 | AC-30 |
| P3-10 | Landing mobile nav menu | §6.1 | AC-30 |
| P3-11 | Sign-in error not duplicated; no self-link | §4.7, §6.2 | AC-17 |
| P3-12 | Command palette search label honest/focuses field | §4.4 | AC-30 |
| P3-13 | Settings primary Add actions/card/case consistency | §6.7.1, §6.7.5/6 | AC-27 |
| P3-14 | Provider URLs/model IDs readable (wrap/tooltip/copy) | §6.7.5 | AC-24 |
| P3-15 | Import preview stacks at 320; no duplicate actions | §6.5.2 | AC-15 |
| P3-16 | Message delete uses shared confirm contract | §5.5, §6.4.2 | AC-20 |

**Coverage check:** 58/58 findings mapped. No finding is closed by “looks better”; every row maps to a behavior and a test.

---

## 13. Definition of done

A change is complete only when:

1. The affected sections of this document are updated and reviewed.
2. The page works at 320, 390, 768, 1024, 1440, 844×390, 320×568, and 200% zoom.
3. Loading, empty, filtered-empty, query error, mutation error, destructive confirm, success, and not-found states are implemented and tested.
4. All controls have names, focus, and 44px mobile hit areas.
5. No raw markup, placeholder copy, dead controls, or hidden primary actions remain.
6. Automated gates in §11.2 pass.
7. A visual-regression snapshot is reviewed for the changed routes.
8. The PR description links the requirement(s) and acceptance test(s) it implements.
9. The audit closure matrix status is updated (all rows closed).
10. Documentation (user docs, `CONTRIBUTING.md`, this spec) agrees with the shipped behavior.

---

## 14. Implementation map

This map is guidance, not a mandate to use these exact files; it shows where the fixed state lives.

| Area | Primary files |
|---|---|
| Shell, header, tab bar, New sheet | `src/components/Header.tsx`, `src/components/common/MobileTabBar.tsx`, new `NewSheet`, `src/routes/__root.tsx` |
| Page shell/header/section picker | new `src/components/common/PageShell.tsx`, `PageHeader.tsx`, new `SectionPicker.tsx`, `SectionNav.tsx` |
| Design tokens/typography/motion | `src/styles.css`, `src/fonts.css`, `static/fonts/`, new font asset check |
| States | `src/components/common/{Skeletons,EmptyState,ErrorBanner,ConfirmDialog}.tsx` |
| Overlays/forms | `src/components/ui/{dialog,sheet,field,input,textarea,switch}.tsx`, new shared overlay header/footer |
| Characters | `src/routes/characters/{index,new,$id,$id_.edit}.tsx`, `src/components/character/**`, `SaveBar.tsx` |
| Lorebooks | `src/routes/lorebooks/{index,new,$id}.tsx`, `src/components/lorebook/**`, `src/hooks/useLorebooks.ts` |
| Chats | `src/features/chat/ui/pages/**`, `components/**`, `settings/**`, `src/routes/chat/**` |
| Settings | `src/routes/settings/**`, `src/components/{ai,preset,settings}/**` |
| Onboarding | `src/features/onboarding/**`, `src/hooks/useOnboarding.ts` |
| Auth/public | `src/routes/{signin,setup,index,__root}.tsx` |
| Content preview | new `plainExcerpt` utility, `src/features/chat/ui/components/chat-row.tsx`, `src/routes/characters/index.tsx`, `src/db/repositories/chats.ts` |
| Document titles | route `head` definitions across `src/routes` |
| Tests | route/component tests, Playwright visual/a11y suite, font URL CI |

**No data migration is required for these UI changes.** The exception is if `plainExcerpt` is computed in a repository query; it must remain a presentation concern and not alter stored content.

---

## 15. Decisions and assumptions

1. **Dark only.** Charon remains dark-first with no light theme. The tokens and contrast rules still apply.
2. **Single user.** Authentication remains single-owner. “Sign up” is a first-run setup action, not registration.
3. **Character cards use 3:4 portraits.** This aligns the library with character art and removes the square-vs-4:3 mismatch. Card density is adjusted by lane count, not by distorting the ratio.
4. **Settings and character-edit sections use a mobile picker.** Hidden-scrollbar rows are removed. This trades horizontal discovery for an explicit, labelled control.
5. **One New flow.** Header New, tab-bar Create, and the chat-list CTA all open the same New sheet. They do not navigate to different destinations.
6. **No fixed duplicate CTAs on character detail.** One action set; the page scrolls; the tab bar remains.
7. **Chat actions collapse on mobile.** Five always-on icons are replaced by one overflow menu; desktop reveals on hover/focus.
8. **Toasts sit top-center on mobile.** This avoids the tab bar and composer.
9. **text-3 remains a caption token.** It is not redefined; its use is restricted, and surface/popover metadata uses `text-2`.
10. **No new heavy dependencies.** The fixed state should be achievable with the existing stack and shared primitives. If a dependency is added, it must not duplicate an existing primitive.
11. **Browser support.** Current Chrome, Safari, Firefox, and Edge; 320px minimum; reduced motion and 200% zoom supported. No IE.
12. **The audit report is historical.** `AUDIT.md` describes the old state. This document describes the target; do not “fix” the target back to the audit.

---

### 15.1 Non-goals

- No light theme, theme switcher, or per-user palette.
- No multi-user accounts, invitations, roles, or public registration.
- No changes to the branching tree model, generation semantics, or provider integrations.
- No native mobile/desktop app; this is the responsive web UI.
- No new landing-page marketing claims beyond the current product behavior.
- No new dependencies that duplicate the existing component primitives.

### 15.2 Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-22 | Initial post-remediation target state, derived from the 58-finding UI audit. |

## Appendix A — Canonical component inventory

| Component | Contract |
|---|---|
| `PageShell` | width variant, padding, bottom clearance, skip target |
| `PageHeader` / `PageTitle` | back, H1, subtitle, responsive actions |
| `SectionPicker` | labelled mobile section selector, 44px |
| `NewSheet` | one create flow |
| `Skeletons` | `SkeletonRows`, `SkeletonCardGrid`, `SkeletonForm`, page-specific |
| `EmptyState` | icon, title, description, one primary action |
| `ErrorBanner` | friendly message, optional Retry, preserve context |
| `ConfirmDialog` | named object, consequences, destructive, focus |
| `OverlayHeader/Footer/Close` | sticky, 44px close, consistent footer |
| `SaveBar` | persistent save/discard, mobile above tab bar |
| `FormField` | label, hint, error, `aria-invalid`/describedby |
| `ChipInput` | visible boundary, keyboard commit/remove |
| `RowActionsMenu` | 40/44 trigger, labelled |
| `OptimizedImage` | preset, srcset, fallback |
| `Toaster` | desktop bottom-right / mobile top-center |

---

## Appendix B — Page-level “fixed” assertions

These are the one-line assertions a reviewer can use to accept each page.

- **Landing:** mobile nav reachable; copy command 44px; no overflow; CTA works.
- **Sign-in:** no dead Sign up after setup; authed redirect; 44px reveal/submit; no extra scroll.
- **Onboarding:** Next always advances or shows an error; action visible; status error recoverable; exit available.
- **Chats:** one create flow; search visible while scrolled; five states; cards plain text.
- **Chat:** names readable at 320; one action menu; composer compact; error has a back.
- **Chat settings:** every section reachable at 320; save status; prompts expand; lightbox works.
- **Characters:** cards uniform, plain text, named import; search sticky; error not empty.
- **Character import:** preview readable at 320; transport errors handled; one exit.
- **Character detail:** title/back first; one CTA set; content clears bars; lightbox works.
- **Character edit:** Save appears, persists, guards; section picker shows active.
- **Lorebooks:** header stacks; switch focus; retry; toggle errors.
- **Lorebook new:** H1; inline validation; one exit.
- **Lorebook detail:** search works; rows readable; entries states honest; config editable; delete navigates.
- **Settings:** active section visible; dialogs fit; every control 44; save/error states.
- **404/root error:** Back to chats; no extra scroll.

---

**End of specification.** If the implementation and this document disagree, this document is the source of truth. If reality requires a different behavior, change this document first, with the reason and acceptance test, then implement it.
