/**
 * Presentation helpers for user-authored card and chat text.
 *
 * Character cards routinely contain HTML, CSS, Markdown, and template
 * macros. Lists and previews must render a readable sentence, never
 * markup. Keep this module pure and dependency-free so both the client and the
 * server can call it.
 */

const TEMPLATE_TOKEN = /\{\{\s*[^{}]*\s*\}\}/g;
const STYLE_OR_SCRIPT = /<(style|script|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const HTML_TAG = /<\/?[a-z][^>]*>/gi;
const IMAGE_MD = /!\[[^\]]*\]\([^)]*\)/g;
const LINK_MD = /\[([^\]]*)\]\([^)]*\)/g;
const CODE_FENCE = /(?:```|~~~)[^\n]*\n?([\s\S]*?)(?:(?:```|~~~)|$)/g;
const INLINE_CODE = /`([^`]*)`/g;
const HEADING = /^\s{0,3}#{1,6}\s+/gm;
const BLOCKQUOTE = /^\s{0,3}>\s?/gm;
const LIST_MARKER = /^\s{0,3}(?:[*+-]|\d{1,9}[.)])\s+/gm;
const TABLE_RULE = /^\s*\|?[\s:|-]+\|?\s*$/gm;
const TABLE_PIPE = /\|/g;
const RULE = /(?:^|\s)-{3,}(?=\s|$)/g;
const EMPHASIS =
  /\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g;

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
};

function decodeEntities(value: string): string {
  return value.replace(/&(?:[a-z]+|#\d+|#x[0-9a-f]+);/gi, (entity) => {
    const named = HTML_ENTITIES[entity.toLowerCase()];
    if (named) return named;
    const numeric = /^&#(?:x([0-9a-f]+)|(\d+));$/i.exec(entity);
    if (!numeric) return " ";
    const code = numeric[1] ? Number.parseInt(numeric[1], 16) : Number.parseInt(numeric[2]!, 10);
    if (!Number.isFinite(code) || code <= 0) return " ";
    try {
      return String.fromCodePoint(code);
    } catch {
      return " ";
    }
  });
}

/**
 * Turn author-authored Markdown/HTML into a single readable line.
 * Safe to call with arbitrary card content; never throws.
 */
export function toPlainText(input: string | null | undefined): string {
  if (!input) return "";
  let text = String(input);

  text = text.replace(TEMPLATE_TOKEN, " ").replace(STYLE_OR_SCRIPT, " ").replace(HTML_COMMENT, " ");
  // Markdown images before links so the `![` form is not half-consumed.
  text = text.replace(IMAGE_MD, " ");
  text = text.replace(LINK_MD, "$1");
  text = text.replace(CODE_FENCE, " $1 ");
  text = text.replace(INLINE_CODE, "$1");
  text = text.replace(HTML_TAG, " ");
  text = text.replace(HEADING, "").replace(BLOCKQUOTE, "").replace(LIST_MARKER, "");
  text = text.replace(TABLE_RULE, " ").replace(TABLE_PIPE, " ");
  text = text.replace(RULE, " ");
  text = text.replace(
    EMPHASIS,
    (_match, bold, boldAlt, strike, italic, italicAlt) =>
      bold ?? boldAlt ?? strike ?? italic ?? italicAlt ?? "",
  );
  text = decodeEntities(text);

  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/** Split a string at a grapheme-safe boundary near `max` characters. */
export function truncateText(text: string, max: number): string {
  if (max <= 0) return "";
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, max).join("").trimEnd()}…`;
}

/**
 * A preview for cards and rows: plain text first, then a hard character cap.
 * Returns an empty string when the source only contained markup.
 */
export function plainExcerpt(
  input: string | null | undefined,
  options: { max?: number } = {},
): string {
  const max = options.max ?? 180;
  return truncateText(toPlainText(input), max);
}
