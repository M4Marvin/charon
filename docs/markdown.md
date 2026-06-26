# Markdown Rendering System

Full-stack markdown + HTML rendering pipeline for chat messages and character content. Replaces the original streamdown renderer with showdown + DOMPurify, adds VN-style dialogue highlighting, CSS sandboxing, streaming-safe DOM patching via morphdom, and a per-user settings panel.

---

## Architecture

```
Raw markdown string
  │
  ├─ balanceMarkdown()      — streams: close unpaired **, `, ```, ~~~
  │
  ▼
showdown.Converter          — GFM, emoji, tables, line breaks
  │
  ▼
<style> extraction          — scopeCss() via @adobe/css-tools
  │
  ▼
DOMPurify.sanitize()        — blocks XSS, forbids tags per settings
  │
  ▼
highlightDialogue()         — DOM walk, wraps "..." in <span>
  │
  ▼
<style> re-injection        — scoped CSS prepended (after sanitize)
  │         ▲
  │   scopeCss() ───────────────── scoped to .rt-<useId>
  │
  ▼
RichText — morphdom patch   — childrenOnly, fade-in, isEqualNode skip
  │
  ▼
DOM in bubble / detail page
```

**Key invariant:** CSS is extracted *before* sanitize, scoped via a full AST parse+stringify pass, and re-injected *after* sanitize. The resulting `<style>` tag contains only parser-normalized, selector-scoped CSS — never raw user input.

---

## Files

| File | Role |
|---|---|
| `src/lib/markdown.ts` | showdown converter, DOMPurify hooks, CSS scoping, dialogue highlighting, `renderMarkdown()`, `balanceMarkdown()` |
| `src/components/RichText.tsx` | React shell: mount guard, morphdom effect, fade-in, settings consumption |
| `src/components/MarkdownContent.tsx` | Thin wrapper: `RichText` inside Tailwind prose |
| `src/lib/richtext-settings.tsx` | React context + localStorage persistence for toggles |
| `src/components/ChatSettingsPanel.tsx` | Display tab with Highlight dialogue + Block external media switches |
| `src/styles.css` | `.rt-msg-in` (fade-in), `.rt-dialogue` + `--dialogue` token |

---

## Core: `renderMarkdown()`

`src/lib/markdown.ts:120`

```ts
function renderMarkdown(content: string, opts?: RenderMarkdownOpts): string
```

### Options

```ts
interface RenderMarkdownOpts {
  scopeId?: string;            // CSS scope class (e.g. "rt-r0")
  blockExternalMedia?: boolean; // strip http(s):// src/srcset; forbid video/audio/embed
  highlightDialogue?: boolean;  // wrap "..." in <span class="rt-dialogue">
}
```

### Pipeline (in order)

1. **SSR guard** — returns `""` on server (no `window`).

2. **Showdown** — single instance, configured identically to SillyTavern:
   ```
   emoji, tables, strikethrough, underline, simpleLineBreaks,
   literalMidWordUnderscores, parseImgDimensions,
   disableForced4SpacesIndentedSublists
   ```

3. **`<style>` extraction** — if `scopeId` provided, each `<style>…</style>` block is removed from the HTML body and sent through `scopeCss()` (see below). Empty/failed scopes are dropped. Uses `String.prototype.replace()` with callback — handles multiple blocks correctly.

4. **DOMPurify config** — built per call:
   - Default: safe tags + attributes, `FORBID_TAGS: none`.
   - When `blockExternalMedia`: `FORBID_TAGS: ["video","audio","source","embed","iframe","object"]`.

5. **DOMPurify sanitize** — runs the global hooks (see "Security Hooks" below).

6. **Dialogue highlighting** — if `highlightDialogue` is true, walks the sanitized DOM and wraps `"…"` segments in `<span class="rt-dialogue">` (see below).

7. **CSS re-injection** — if scoped blocks exist, escapes `</style>`/`</script>` and prepends:
   ```html
   <style class="rt-scoped">…</style>
   ```
   The `<style>` tag is appended *after* sanitize, so it is never scrubbed by DOMPurify.

---

## CSS Scoping (`scopeCss`)

`src/lib/markdown.ts:60`

Uses `@adobe/css-tools` (`parse` + `stringify`) to transform arbitrary CSS so it only applies within the host bubble.

### Transform rules

| Input | Output |
|---|---|
| `body { color: red; }` | `.rt-r0 { color: red; }` |
| `h1 { font-size: 2em; }` | `.rt-r0 h1 { font-size: 2em; }` |
| `:root { --x: 1; }` | `.rt-r0 { --x: 1; }` |
| `* { box-sizing: border-box; }` | `.rt-r0 { box-sizing: border-box; }` |
| `@import url("…");` | **dropped** |
| `@charset "utf-8";` | **dropped** |
| `@namespace …` | **dropped** |
| `@media (max-width: 600px) { … }` | recursed into `.rules` |
| `@supports (…) { … }` | recursed into `.rules` |
| `@keyframes fade { from {…} to {…} }` | passed through (keyframes recursed) |
| `url(https://…)` (when `blockExternalMedia`) | → `url()` (emptied) |

Selector prefixing uses `scopeSelector()` which collapses `:root`, `html`, `body`, and `*` to the scope class itself; all other selectors get `.scopeId ` prepended.

`parse()` is called with `{ silent: true }` — malformed CSS silently returns `""` rather than throwing.

---

## Security Hooks

All registered once at module load (`registerDOHooks()`), guarded by `_hooksRegistered` flag. Browser-only (`typeof window` check).

### `target="_blank"` on all links

`afterSanitizeAttributes` hook sets `target="_blank"` and `rel="noopener noreferrer nofollow"` on every `<a>` element. No opt-out — applies globally.

### External media blocking (attribute-level)

`uponSanitizeAttribute` hook reads the module-level `_blockExternalMedia` flag (set per-call in `renderMarkdown` before `sanitize()`). When active:

- Strips `src` and `srcset` attributes whose value starts with `http://` or `https://`.
- `data:` URIs, relative paths, and root-relative paths are **preserved**.
- `<img>` tags remain in the DOM (shows alt text or broken icon).

Combined with `FORBID_TAGS` for `<video>`, `<audio>`, `<source>`, `<embed>`, `<iframe>`, `<object>`, this provides comprehensive *privacy-first* external resource blocking while keeping inline base64 images visible.

---

## Dialogue Highlighting

`src/lib/markdown.ts:158`

### Detection

Regex: `"[^"]*"/g` — matches straight double-quote segments including the quotes.

### DOM walk

Recursively walks sanitized HTML using `document.createElement("template")`. Skips subtrees rooted at `<code>`, `<pre>`, `<style>`, `<script>` (the `SKIP_TAGS` set).

For each text node:

1. Run `DIALOGUE_RE.exec(text)` — if no match, skip.
2. Build a `DocumentFragment`:
   - Text before match → `document.createTextNode()`.
   - Matched segment → `<span class="rt-dialogue">` with `textContent` set to the full match (including quotes).
   - Text after match → appended after the loop.
3. Replace the original text node with the fragment via `parentNode.replaceChild()`.

### Edge cases handled

| Input | Behaviour |
|---|---|
| `Mei: "Come sit, come sit~"` | `Mei: <span>"Come sit, come sit~"</span>` |
| `"She said 'hello' to me."` | Outer double-quoted segment wrapped; inner single quotes untouched |
| `It's worth it.` | Apostrophe does not match |
| `5'10" tall` | Stray `"` at end — matches if paired with earlier opening `"` in same text node; rare |
| `"Hello` (unclosed) | No match, left as plain text |
| Code block: `` `<p>"hi"</p>` `` | Showdown escapes `"` to `&quot;` inside code, so no match |
| Inline code: `` `"hi"` `` | Same — escaped by showdown |

### Styling

```css
/* styles.css:48 */
.rt-dialogue {
  color: var(--dialogue);
}

/* Theme token (both :root and .dark) */
--dialogue: oklch(0.85 0.06 75);  /* warm cream-gold */
```

Matches the existing sea-teal palette (complements `--primary` amber and contrasts with `--foreground` white).

---

## Streaming Support

### `balanceMarkdown(text, isFinal)`

`src/lib/markdown.ts:222`

During SSE streaming, prevents markdown syntax breakage by closing unpaired tokens:

| Token | Closing |
|---|---|
| `*` | `*` |
| `"` | `"` |
| `` ``` `` | `\n```\n` |
| `~~~` | `\n~~~\n` |

Called in `src/routes/chats/$id.tsx`:
```tsx
<RichText
  content={isStreaming ? balanceMarkdown(message.content, false) : message.content}
/>
```

### morphdom patching

`src/components/RichText.tsx:51` — streams update the DOM via morphdom instead of `innerHTML = ...`. Benefits:

- **Preserves scroll position** during fast streaming.
- **Preserves text selection** (user can select mid-stream).
- **Preserves input caret** and CSS transition states.
- **Only changed nodes update** — `isEqualNode` pre-check skips identical subtrees.
- **New block elements fade in** — `onNodeAdded` callback adds `rt-msg-in` class.

### Fade-in

```css
/* styles.css:44 */
.rt-msg-in {
  animation: var(--animate-msg-in);
}

/* In @theme block — styles.css:41 */
--animate-msg-in: msg-in 0.3s ease-out;

/* Keyframes — styles.css:30 */
@keyframes msg-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Block-level elements only: `p`, `h1-6`, `ul`, `ol`, `li`, `table`, `pre`, `blockquote`, `div`, `img`, `figure`, `figcaption`. Inline and text-node growth patches in-place (no flicker).

---

## Settings & Controls

### `RichTextSettingsProvider`

Wraps the app at `src/routes/__root.tsx:61`, inside `TanstackQueryProvider`. Provides a `RichTextSettingsCtx` context containing:

```ts
interface RichTextSettings {
  blockExternalMedia: boolean;
  setBlockExternalMedia: (v: boolean) => void;
  highlightDialogue: boolean;
  setHighlightDialogue: (v: boolean) => void;
}
```

Persisted to `localStorage["stv.richtext"]` as JSON. Defaults:

| Setting | Default |
|---|---|
| `blockExternalMedia` | `false` |
| `highlightDialogue` | `true` |

### Display tab

In `ChatSettingsPanel` (per-chat gear icon), a **Display** tab renders two `Switch` controls:

1. **Highlight dialogue** — toggles dialogue colour highlighting.
2. **Block external media** — toggles external image/video/embed blocking.

Both controls update instantly and persist across page reloads.

---

## RichText Component

`src/components/RichText.tsx:26`

### Props

```ts
{ content: string }
```

### Lifecycle

1. **SSR** — returns `null` (bubbles populate after client hydration).
2. **Mount** — `useEffect` sets `mounted = true`.
3. **Render** — `useMemo` computes `html` via `renderMarkdown(content, { scopeId, blockExternalMedia, highlightDialogue })`.
4. **Patch** — `useEffect` creates a detached `div`, sets `innerHTML`, and calls `morphdom(ref.current, toDiv, { childrenOnly: true, onBeforeElUpdated, onNodeAdded })`.
5. **Re-render** (streaming) — same effect fires on each `html` change; morphdom diffs and patches only what changed.

### Scope ID

```ts
const scopeId = `rt-${useId().replace(/:/g, "")}`;
```

- Uses React 19 `useId()` — stable per component instance across re-renders.
- Strip colons (CSS pseudo-class syntax).
- Prefix with `rt-` to reduce collision with user-authored CSS.
- Applied as the root `<div>`'s class; CSS scoping selectors target `.rt-r0`, `.rt-r1`, etc.

### morphdom options

| Option | Value | Purpose |
|---|---|---|
| `childrenOnly` | `true` | Patches children, preserves the React-owned root `<div>` |
| `onBeforeElUpdated` | `(f,t) => f.isEqualNode(t) ? false : true` | Skips unchanged subtrees (morphdom FAQ optimisation) |
| `onNodeAdded` | `node => …` | Adds `rt-msg-in` class to newly inserted block elements |

No `getNodeKey` — morphdom uses positional + `id` attribute matching by default, which works correctly for our bounded message DOM trees.

---

## Consumer Usage

### Chat messages — `src/routes/chats/$id.tsx`

```tsx
<RichText
  content={isStreaming ? balanceMarkdown(message.content, false) : message.content}
/>
{isStreaming && <StreamingCaret />}
```

The `StreamingCaret` is a sibling (not inside `RichText`), so morphdom patching does not interfere with it.

### Character detail — `src/routes/characters/$id.tsx`

```tsx
import { MarkdownContent } from "@/components/MarkdownContent";

<MarkdownContent content={data.description} />
<MarkdownContent content={data.personality} />
<MarkdownContent content={data.scenario} />
// … 13 call sites total
```

`MarkdownContent` is a thin wrapper that applies Tailwind prose classes around `RichText`. All character detail fields that support markdown use it — and respect the same `blockExternalMedia` / `highlightDialogue` settings as chat.

---

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `showdown` | ^2.1.0 | Markdown → HTML converter (mirrors SillyTavern config) |
| `dompurify` | ^3.4.11 | HTML sanitizer, XSS prevention |
| `@adobe/css-tools` | ^4.5.0 | CSS AST parser + stringifier for `<style>` scoping |
| `morphdom` | ^2.7.8 | DOM diff + patch for streaming-safe updates |
| `@types/showdown` | ^2.0.6 | Dev types for showdown |

All ship ESM-compatible builds; all have built-in TypeScript declarations.

---

## Test Plan

Smoke tests (run with `nub run dev`):

1. **Links** — send `[test](https://example.com)` → inspect DOM for `target="_blank" rel="noopener noreferrer nofollow"`.
2. **CSS scoping** — send `<style>body{background:red}</style><p>hi</p>` → red background only inside the bubble, not the page.
3. **Multiple `<style>` blocks** — send `<style>p{color:red}</style><style>em{color:blue}</style>` → both are scoped and applied.
4. **Dialogue highlighting** — send `Mei: "Come sit, come sit~"` → `"Come sit, come sit~"` renders in warm cream-gold.
5. **External media toggle** — place `<img src="https://example.com/a.png">` in a message, toggle on in Display tab → img src stripped (alt text shown). `data:` images preserved.
6. **Streaming fade-in** — start streaming a long message → new paragraphs fade in with 0.3s ease-out.
7. **Code blocks untouched** — send `` `"hello"` `` → no dialogue highlighting inside inline code.
8. **Block external media + data:img** — `<img src="data:image/png;base64,...">` survives the toggle.
