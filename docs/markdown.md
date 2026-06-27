# Markdown Rendering System

Full-stack markdown + HTML rendering pipeline for chat messages and character content. Uses showdown + DOMPurify with pre-showdown `<q>` quote wrapping (ported from SillyTavern), `fixMarkdown` auto-repair, CSS sandboxing with `custom-` class namespacing, streaming-safe DOM patching via morphdom, code copy buttons, and a per-user settings panel.

---

## Architecture

```
Raw markdown string
  │
  ├─ fixMarkdown()            — repair broken **/__ spacing + unpaired * / "
  │
  ├─ wrapQuotes()             — wrap "…" / “…” / «…» / 「…」 / 『…』 / ＂…＂ in <q>
  │                             (pre-showdown — protects code blocks + <style>)
  │
  ▼
showdown.Converter            — GFM, emoji, tables, line breaks, underscore ext
  │
  ├─ Firefox <br> fix         — stash/restore \n inside <code> via \x00 pass
  │
  ▼
<style> extraction            — scopeCss() via @adobe/css-tools
  │  ▲ (class selectors namespaced to custom-*)
  │
  ▼
DOMPurify.sanitize()          — MESSAGE_SANITIZE: class→custom-*, XSS harden, br in unknown els
  │
  ├─ element-level media block — removes nodes with external src/srcset/data (not just attrs)
  │
  ▼
addCopyToCodeBlocks()         — injects hover-reveal "Copy" button on <pre><code>
  │
  ▼
<style> re-injection          — scoped, namespaced CSS prepended (after sanitize)
  │
  ▼
RichText — morphdom patch     — childrenOnly, fade-in, isEqualNode skip
  │
  ▼
DOM in bubble / detail page   — .rt-mes-text class provides ST-parity styling
```

---

## Files

| File | Role |
|---|---|
| `src/lib/markdown.ts` | showdown converter (+underscore ext + unhashHTMLSpans patch), DOMPurify hooks (class rewrite, element media block, unknown-el br), CSS scoping with custom- namespacing, wrapQuotes, fixMarkdown, code copy button injection, `renderMarkdown()`, `balanceMarkdown()` |
| `src/components/RichText.tsx` | React shell: mount guard, morphdom effect, fade-in, settings consumption, `rt-mes-text` class |
| `src/components/MarkdownContent.tsx` | Thin wrapper: `RichText` inside Tailwind prose (character detail) |
| `src/lib/richtext-settings.tsx` | React context + localStorage persistence for blockExternalMedia, highlightDialogue, autoFixMarkdown |
| `src/styles.css` | `.rt-mes-text` stylesheet (ST message-text parity), `.code-copy-wrapper`/`.code-copy-button`, theme tokens `--rt-em-color` / `--rt-underline-color` / `--dialogue` |

---

## Core: `renderMarkdown()`

`src/lib/markdown.ts`

```ts
function renderMarkdown(content: string, opts?: RenderMarkdownOpts): string
```

### Options

```ts
interface RenderMarkdownOpts {
  scopeId?: string;            // CSS scope class (e.g. "rt-r0")
  blockExternalMedia?: boolean; // remove nodes with external src/srcset/data
  highlightDialogue?: boolean;  // wrap quotes in <q> tags (pre-showdown)
  autoFixMarkdown?: boolean;    // repair broken * _ spacing + close unpaired tokens
}
```

### Pipeline (in order)

1. **SSR guard** — returns `""` on server (no `window`).

2. **`fixMarkdown`** — if `autoFixMarkdown` is true:
   - Finds `**…**` / `*…*` / `__…__` / `_…_` pairs and strips adjacent whitespace from the delimiters (e.g. `* bold *` → `*bold*`).
   - Closes unpaired `*` and `"` per line to prevent runaway formatting.

3. **`wrapQuotes`** — if `highlightDialogue` is true:
   - Stashes `"` inside HTML tags (`\ufffe` sentinel) to prevent false matches.
   - Wraps six quote styles in `<q>`: straight `"…"`, curly `""…""`, guillemets `«…»`, corner brackets `「…」`/`『…』`, fullwidth `＂…＂`.
   - `<style>`, fenced code, and inline code are protected from matching.
   - Restores stashed quotes in tags after wrapping.

4. **Showdown** — single instance with extensions:
   - Options: `emoji`, `tables`, `strikethrough`, `underline`, `simpleLineBreaks`, `literalMidWordUnderscores`, `parseImgDimensions`, `disableForced4SpacesIndentedSublists`.
   - Extension `markdownUnderscoreExt`: single `_word_` → `<em>` with negative-lookbehind (skips code/style tags). Falls back gracefully if browser lacks lookbehind support.
   - `addShowdownPatch`: recursive `unhashHTMLSpans` fix for nested inline HTML spans. No-op if API incompatible.

5. **Code-block `<br>` fix** — replaces `\n` inside `<code>` with `\x00`, then restores after. Prevents Firefox from injecting extra `<br>` elements in code blocks.

6. **`<style>` extraction** — each `<style>…</style>` block removed from body, passed through `scopeCss()`. Class selectors (`\.foo`) are namespaced to `\.custom-foo` (except `fa-*`, `note-*`, `monospace`, `rt-*`, `custom-*`). Selectors are scoped under `.rt-<id>`.

7. **DOMPurify sanitize** — `MESSAGE_SANITIZE: true`:
   - **Class rewriting**: `class="foo bar"` → `class="custom-foo custom-bar"` (except allowlisted `fa-*`, `note-*`, `monospace`, `rt-*`, `custom-*`).
   - **Unknown element `<br>`**: in `HTMLUnknownElement` nodes, `\n` → `<br>` (unless inside `<pre>`).
   - **Element-level media blocking** (when `blockExternalMedia`): removes `<img>`, `<audio>`, `<video>`, `<source>`, `<track>`, `<embed>`, `<object>` nodes whose `src`, `srcset`, or `data` attributes point to external URLs. `data:` URIs and relative paths survive.

8. **Code copy buttons** — injects `<div class="code-copy-wrapper">` around each `<pre>`, with a hover-reveal `<button class="code-copy-button">Copy</button>` that uses `navigator.clipboard.writeText`.

9. **CSS re-injection** — scoped + namespaced blocks prepended as `<style class="rt-scoped">…</style>`.

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

### `MESSAGE_SANITIZE` class rewriting

`uponSanitizeAttribute` hook: when `config.MESSAGE_SANITIZE` is true and `data.attrName === "class"`, each class token is prefixed with `custom-` unless it matches the allowlist: `fa-*`, `note-*`, `monospace`, `rt-*`, or already `custom-*`. Prevents user-authored CSS classes from colliding with application classes.

### Unknown-element `<br>` conversion

`uponSanitizeElement` hook (when `MESSAGE_SANITIZE`): for `HTMLUnknownElement` nodes, splits text content on `\n` and replaces with `<br>` elements (unless inside `<pre>`). Ensures newlines in custom/unknown tags render as line breaks.

### External media blocking (element-level)

`uponSanitizeElement` hook (when `MESSAGE_SANITIZE` and `_blockExternalMedia`): removes `<img>`, `<audio>`, `<video>`, `<source>`, `<track>`, `<embed>`, `<object>` nodes whose `src`, `srcset`, or `data` attributes point to external URLs (checking each URL in `srcset` separately). `data:` URIs and relative/root-relative paths are preserved. `<HTMLMediaElement>` instances have autoplay disabled and are paused before removal.

---

## Quote Wrapping (Pre-Showdown `<q>`)

Runs on raw markdown text **before** showdown, ported from SillyTavern's `messageFormatting` (`script.js:1854-1886`).

### Detection

A single regex handles six quote styles with code/style protection:
```
<style>…</style> | ```…``` | ~~~…~~~ | ``…`` | `…` | "…" | "…" | «…» | 「…」 | 『…』 | ＂…＂
```
Non-quoted alternatives (style, code) are matched but returned unchanged. Matched quotes are wrapped in `<q>…</q>` tags.

### Quote stash/restore

Before the regex, `"` characters inside HTML tags (`<tag attr="val">`) are replaced with the sentinel `\ufffe` to prevent false matches. After the regex, sentinels are restored to `"`.

### Why pre-showdown

By wrapping before showdown, the `<q>` tag is treated as raw inline HTML passthrough. The quoted content is NOT processed by markdown — dialogue stays verbatim. Post-showdown DOM walking (the old approach) broke whenever inline formatting split the text node between opening and closing `"`. The pre-showdown approach avoids this entirely.

### Edge cases handled

| Input | Behaviour |
|---|---|
| `Mei: "Come sit, come sit~"` | `Mei: <q>"Come sit, come sit~"</q>` |
| `"this *bold* text"` | `<q>"this *bold* text"</q>` — markdown inside quote NOT processed |
| `` `"code"` `` | Protected as inline code — no `<q>` wrapping |
| ```` ```\n"fenced"\n``` ```` | Protected as fenced code |
| `<img title="tooltip">` | `"` in title stashed as `\ufffe`, restored after wrapping |
| `""She said hello""` (curly) | `<q>""She said hello""</q>` |
| `「こんにちは」` (corner brackets) | `<q>「こんにちは」</q>` |
| `"Hello` (unclosed) | Not matched by `".*?"` — left as plain text |
| `"first" and "second"` | Both matched independently: `<q>"first"</q> and <q>"second"</q>` |

### Styling

```css
/* .rt-mes-text q { color: var(--dialogue); } */
/* .rt-mes-text q i, .rt-mes-text q em { color: inherit; } */
```

The `color: inherit` override on `<q>` descendants ensures inline formatting inside dialogue uses the quote color — a key SillyTavern visual convention.

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
| `autoFixMarkdown` | `true` |

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
2. **CSS scoping** — send `<style>body{background:red}</style><p>hi</p>` → red background only inside the bubble, not the page. Class selectors inside the `<style>` should be namespaced to `custom-` (e.g. `.foo` → `.custom-foo`).
3. **Multiple `<style>` blocks** — send `<style>p{color:red}</style><style>em{color:blue}</style>` → both are scoped and applied.
4. **Dialogue highlighting (ST parity)** — send `Mei: "Come sit, come sit~"` → `"Come sit, come sit~"` renders as `<q>` tag in dialogue cream-gold. `"this *bold* text"` → entire quote wrapped in `<q>`, bold NOT processed (verbatim dialogue).
5. **Smart / curly quotes** — send `""Bonsoir, monsieur""` or `「こんにちは」` → wrapped in `<q>` with dialogue color.
6. **Code blocks protected from quotes** — send `` `"hello"` `` → no `<q>` wrapping inside inline code. Send a fenced code block containing `"` → protected.
7. **External media toggle** — place `<img src="https://example.com/a.png">` in a message, toggle on → entire `<img>` node removed. `data:` images preserved. `<img src="local.png">` preserved.
8. **Streaming fade-in** — start streaming a long message → new paragraphs fade in with 0.3s ease-out.
9. **`fixMarkdown` auto-repair** — send `* bold *` → renders as `<em>bold</em>` (spaces stripped from around `*` delimiters). Send a line with unpaired `*` → auto-closed at end of line.
10. **Code copy button** — any `<pre><code>` block → hover reveals "Copy" button in top-right corner. Click copies to clipboard, button briefly shows "Copied!".
11. **`<font color>` support** — send `<font color="red">text</font>` → preserves tag and attribute; text renders in red via CSS.
12. **`q i` / `q em` color inherit** — italic inside dialogue quotes inherits the dialogue color, not the em accent color.
13. **Custom class namespacing** — a message `<span class="myclass">text</span>` → DOM shows `class="custom-myclass"`.
14. **Unknown element newlines** — a custom/unknown tag containing `\n` → newlines converted to `<br>`.
