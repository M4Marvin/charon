# Chat page hook audit (`/chat/$id`)

A hook-by-hook audit of the chat page React tree, asking one question per hook:
*can this be CSS, HTML, or browser behavior instead — or can the same UX be
achieved with less state?*

Date: 2026-11-15 · Branch: `refactor/chat-page-hook-cleanup`

## Scope

Everything rendered by the `/chat/$id` route:

- `src/routes/chat/$id.tsx`, `src/features/chat/ui/pages/chat-page.tsx`
- `components/`: `message-list`, `composer`, `chat-message`, `chat-header`,
  `chat-background`, `character-portrait-panel`, `custom-image-panel`,
  `image-lightbox`, `selection-prompt-dialog`, `message-rewrite-button`,
  `message-overview-rail`
- `settings/`: `settings-panel`, `settings-nav`, `save-status`,
  `blur-commit-textarea` (the `sections/*` forms were swept too — all their
  hooks are TanStack Query, dialog-open booleans, and draft state; nothing to
  change)

Out of scope: the `/chat` list page (`chat-row`, `chat-day-group`,
`rename-chat-dialog`, `chat-list-page`), shared `components/ui/*` primitives
(only read to verify what they already provide), and the chat *list* feature
generally.

## Browser-support facts (checked 2026-11-15)

| Feature | Baseline | Support | Use |
|---|---|---|---|
| `field-sizing: content` | 2026-06 (Firefox 152 closed the gap) | Chrome 123+, Safari 26.2+, Firefox 152+ (~88%) | Replaces scrollHeight auto-grow for textareas |
| Scroll-driven animations (`animation-timeline: scroll()`) | 2026-10-27 (Firefox 159 closed the gap) | Chrome 115+, Safari 26+, Firefox 159+ (~89%) | Replaces the per-scroll `style.opacity` top fade |

Both are used as progressive enhancements: the JS implementation stays behind
`@supports`/`CSS.supports` gates as a fallback, so the hook shrinks to a legacy
path rather than disappearing.

## Findings

Classification: **CSS/HTML/browser** (replaceable), **better design** (same UX,
less state), **justified** (keep, with reason).

### Replaceable by CSS / HTML / browser behavior

| # | Where | What | Fix | Status |
|---|---|---|---|---|
| 1 | `composer.tsx:68-79` | `useLayoutEffect` auto-grow (`height = scrollHeight`, 120px cap) | `field-sizing: content`; JS behind `@supports not` fallback | done |
| 2 | `chat-message.tsx:97-104` (autosize half) | edit-textarea auto-grow (240px cap) | Same; focus + caret half stays (imperative) | done |
| 3 | `settings/blur-commit-textarea.tsx:68-75` (autosize half) | auto-grow (360px cap) | Same; overflow detection stays (conditional "Expand" button) | done |
| 4 | `message-list.tsx:181-199, 186-188` | per-scroll `style.opacity = scrollTop/64` top fade + initial-sync effect | Named scroll timeline: `scroll-timeline-name` on viewport, `timeline-scope` on scroller root, fade animates over `animation-range: 0px 64px`. A named timeline is required — `scroll(nearest)` would bind to the `overflow-hidden` scroller root, not the viewport. JS behind `@supports not` fallback | done |
| 5 | `chat-page.tsx:104, 622-625` + `chat-header.tsx:23, 133` | manual `focus()` on the settings gear after the settings Sheet closes | Base UI Dialog (what `Sheet` wraps) restores focus to the trigger on close by default (`finalFocus` default = "trigger or previously focused element"). Drop the ref + prop plumbing | done |
| 6 | `character-portrait-panel.tsx:78-88`, `custom-image-panel.tsx:119-129` | `role="button"` div + manual Enter/Space keydown + `tabIndex` juggling | Real `<button>`: role, activation, focus for free | done |

### Better-designed with less state

| # | Where | What | Fix | Status |
|---|---|---|---|---|
| 7 | `chat-page.tsx:110-111, 382-392, 409-412, 416-425` | selection cluster: 2 states + 2 sync effects (reset on chat change; prune ids that left the active path) | Key `ChatPage` on the route param (remount resets per-chat state; the `rename-chat-dialog.tsx:26-28` pattern), and prune via render-time derivation instead of an effect | done |
| 8 | `chat-message.tsx:106-108` | `useLayoutEffect` re-seeds `editContent` when content changes while not editing | Delete — the edit-menu handler (`:239-241`) seeds it on every open, and the value is unread while closed | done |
| 9 | `message-list.tsx:20, 168, 190-199` | `userScrolledUp` state + hand-rolled edge math duplicating the scroller primitive | The primitive already computes exactly this (`useMessageScrollerScrollable().end`, same threshold, per scroll event). Bridge child inside the provider lifts it to the `autoScroll` prop | done |
| 10 | `chat-background.tsx:11-22` | `loadedSrc`/`previousSrc`/`failedSrc` + ref + sync effect ("adjust state when props change") | React's documented render-phase derivation (setState during render) — no ref, no effect, no post-commit flash | done |
| 11 | `character-portrait-panel.tsx:29, 42-56` + `custom-image-panel.tsx:34, 54-73` | duplicated panel plumbing ×2: `onCloseRef` latest-ref effects, window Escape listeners, focus-on-open | One shared `useFloatingPanel` hook (chat feature hooks dir); Escape suppression for the nested confirm dialog becomes a plain boolean dependency instead of a ref mirror | done |
| 12 | `character-portrait-panel.tsx:31-40` + `custom-image-panel.tsx:41-52, 100` | `imageFailed` boolean + reset effects | `failedSrc` (src-keyed) comparison per CONTRIBUTING's fallback pattern — src changes recover with no reset effect; reopen-retry rides the remaining justified open/close effects | done |
| 13 | `image-lightbox.tsx:15-24` | `useLayoutEffect` resetting `zoomed`/`failedSrc` on `[open, src]` | Move both into a `key={src}` child inside `DialogContent` (Base UI unmounts content on close → auto-reset) | done |
| 14 | `selection-prompt-dialog.tsx:32-43` | `useEffect` resetting form on close | Form state moves into a child inside `DialogContent` (unmounts on close → auto-reset). `running` stays in the parent — the Dialog close-guard needs it | done |
| 15 | `message-rewrite-button.tsx:42-52, 82, 95, 110-111` | manual `reset()` on close/accept/deny | Same split: instruction/proposal/error in the content child, `phase` in the parent for the busy-guard, explicit `close()` resets phase | done |
| 16 | `settings-panel.tsx:85-90` | `useEffect` normalizing `activeId` when mode changes | Delete — `handleModeChange` (`:101-109`) already sets both consistently, and `activeSection` already falls back at `:82-83` | done |
| 17 | `settings-panel.tsx:92-95` | `useEffect` tracking `visited` + scroll-to-top on section change | Both are consequences of two events (`handleSectionChange`, `handleModeChange`) — moved into those handlers | done |
| 18 | `composer.tsx:113-163`, `blur-commit-textarea.tsx:77-85` | `useCallback` on handlers consumed by nothing memoized | Dropped (`focusTextarea` stays — it is an effect dependency) | done |
| 19 | `settings-panel.tsx:81, 97-115` | `useMemo` on an 8-item filter; `useCallback` on handlers for non-memoized children | Dropped | done |

### Justified (kept)

| Where | Why |
|---|---|
| `composer.tsx:45-66` autofocus + focusNonce effects, `chat-store.ts:57, 105` | Imperative focus orchestration: `autoFocus` can't skip coarse pointers; the nonce is the cross-component "refocus" signal |
| `composer.tsx:84-111` visualViewport inset | No CSS equivalent for iOS Safari's non-shrinking layout viewport; writes `--keyboard-inset` |
| `message-list.tsx:96-106` `AutoScrollGate` | Re-arms the primitive's internal follow mode — flipping the `autoScroll` prop alone cannot move it out of `"free-scrolling"` (verified in the primitive source) |
| `message-list.tsx:175-177` | "Sending is an intent to read the reply" — resets follow state on a run transition |
| `chat-message.tsx:89-95, 204-208` dialog states + `copied` timer | Controlled dialog state; `copied` is transient feedback CSS can't retrigger (icon + live aria-label swap) |
| `chat-message.tsx:97-104` (focus half) | Entering edit mode needs focus + caret-at-end; `autoFocus` can't place the caret reliably |
| `chat-page.tsx:138-146`, `message-overview-rail.tsx:81-84` | Cheap derived-value memos |
| `chat-page.tsx:180-406` handler block | Stable callbacks preserve `ChatMessage`'s memo during streaming (documented in-code) |
| `character-portrait-panel.tsx:38` / `custom-image-panel.tsx:50` 300ms unmount timer | Memory release of a decoded image after the exit transition; CSS can't unmount an `<img>` |
| `settings-nav.tsx:15-24, 43, 54-58` | Roving-tabindex ARIA pattern: focus override on open, latest-`activeId` ref avoids re-focus on click, imperative focus targets |
| `save-status.tsx:60-71, 89-97, 138-149` | Single live-region owner; "Saved" must decay via JS or screen readers never re-announce a save |
| `message-overview-rail.tsx:88, 94-130, 195-196` | The slider control shares `hovered` between pointer hover and keyboard nav; `setHovered` bails out on same-index |
| `use-generation-chat.ts`, `useChats.ts`, `useChatConfig.ts`, `useGenerationProposals.ts`, `macros.ts` | Server state (TanStack Query) and streaming run-management (run tokens, cancellation, documented `@tanstack/ai-react` connection-capture gotcha) |
| `blur-commit-textarea.tsx:59-66` defaultValue sync | Deliberately left out of this cleanup: the correct replacement (render-phase derivation) would need to read `focusedRef` during render, which is not safe under concurrent rendering |

### Adjacent non-hook fixes (picked up while there)

- `chat-header.tsx:40-48`: back button was `Button onClick={navigate}`; now
  `Button asChild` + `<Link to="/chat">` (codebase convention: real anchor +
  prefetch).
- `chat-page.tsx`: `isBusy || generation.isStreaming` guards collapsed —
  `isBusy` *is* `generation.isStreaming` (`:148`).

## Verification

- `pnpm exec tsc --noEmit` — see below
- `pnpm run lint` — see below
- `pnpm run test` — see below
- `pnpm run build` — see below
- Real browser pass over the chat page (composer growth, streaming follow +
  fade, panel Escape/focus flow, settings open→close focus return, lightbox,
  selection strip, CSS fallback paths) — see below

Results are recorded at the bottom of this file after the implementation pass.
