import showdown from "showdown";
import type { Converter, ShowdownExtension } from "showdown";
import DOMPurify from "dompurify";
import type { Config as DOMPurifyConfig } from "dompurify";
import { parse, stringify } from "@adobe/css-tools";
import type {
  CssAtRuleAST,
  CssDeclarationAST,
  CssRuleAST,
  CssStylesheetAST,
} from "@adobe/css-tools";

let _hooksRegistered = false;
let _blockExternalMedia = false;

function registerDOHooks() {
  if (_hooksRegistered) return;
  if (typeof window === "undefined") return;
  _hooksRegistered = true;

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName?.toLowerCase() === "a") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });

  DOMPurify.addHook("uponSanitizeAttribute", (_node, data, config) => {
    if (
      (config as Record<string, unknown> | undefined)?.MESSAGE_SANITIZE &&
      data.attrName === "class" &&
      data.attrValue
    ) {
      data.attrValue = data.attrValue
        .split(" ")
        .map((v) => {
          if (
            v.startsWith("fa-") ||
            v.startsWith("note-") ||
            v === "monospace" ||
            v.startsWith("rt-") ||
            v.startsWith("custom-")
          ) {
            return v;
          }
          return "custom-" + v;
        })
        .join(" ");
      return;
    }
  });

  DOMPurify.addHook("uponSanitizeElement", (node, _, config) => {
    if (!(config as Record<string, unknown> | undefined)?.MESSAGE_SANITIZE) return;

    // Convert newlines to <br> in unknown elements
    if (node instanceof HTMLUnknownElement) {
      node.innerHTML = node.innerHTML.trim();
      const candidates: Text[] = [];
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const textNode = walker.currentNode as Text;
        if (!textNode.data.includes("\n")) continue;
        if (textNode.parentElement?.closest("pre")) continue;
        candidates.push(textNode);
      }

      for (const textNode of candidates) {
        const parts = textNode.data.split("\n");
        const frag = document.createDocumentFragment();
        parts.forEach((part, idx) => {
          if (part.length) {
            frag.appendChild(document.createTextNode(part));
          }
          if (idx < parts.length - 1) {
            frag.appendChild(document.createElement("br"));
          }
        });
        textNode.replaceWith(frag);
      }
    }

    // External media blocking (element-level removal)
    if (!_blockExternalMedia) return;
    if (!(node instanceof Element)) return;

    switch (node.tagName) {
      case "AUDIO":
      case "VIDEO":
      case "SOURCE":
      case "TRACK":
      case "EMBED":
      case "OBJECT":
      case "IMG": {
        const isExternalUrl = (url: string) =>
          (url.indexOf("://") > 0 || url.indexOf("//") === 0) &&
          !url.startsWith(window.location.origin);
        const src = node.getAttribute("src");
        const dataAttr = node.getAttribute("data");
        const srcset = node.getAttribute("srcset");

        if (srcset) {
          for (const srcsetUrl of srcset.split(",")) {
            const [url] = srcsetUrl.trim().split(" ");
            if (isExternalUrl(url)) {
              node.remove();
              return;
            }
          }
        }

        if (src && isExternalUrl(src)) {
          node.remove();
          return;
        }

        if (dataAttr && isExternalUrl(dataAttr)) {
          node.remove();
          return;
        }

        if (node instanceof HTMLMediaElement) {
          node.autoplay = false;
          node.pause();
        }
        break;
      }
    }
  });
}

registerDOHooks();

let _converter: Converter | null = null;

function canUseNegativeLookbehind(): boolean {
  try {
    new RegExp("(?<!_)");
    return true;
  } catch {
    return false;
  }
}

function markdownUnderscoreExt(): ShowdownExtension[] {
  if (!canUseNegativeLookbehind()) return [];
  return [
    {
      type: "output",
      regex: new RegExp(
        "(<code(?:\\s+[^>]*)?>[\\s\\S]*?<\\/code>|<style(?:\\s+[^>]*)?>[\\s\\S]*?<\\/style>)|\\b(?<!_)_(?!_)(.*?)(?<!_)_(?!_)\\b",
        "gi",
      ),
      replace(match: string, tagContent?: string, italicContent?: string) {
        if (tagContent) return match;
        if (italicContent) return `<em>${italicContent}</em>`;
        return match;
      },
    } as unknown as ShowdownExtension,
  ];
}

function addShowdownPatch(converter: Converter) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (converter as any).subParser(
      "unhashHTMLSpans",
      function (this: any, text: string, _options: unknown, globals: any) {
        "use strict";
        text = globals.converter._dispatch("unhashHTMLSpans.before", text, {}, globals);

        for (let i = 0; i < globals.gHtmlSpans.length; ++i) {
          let repText = globals.gHtmlSpans[i];
          let limit = 0;

          while (/¨C(\d+)C/.test(repText)) {
            const num = RegExp.$1;
            repText = repText.replace("¨C" + num + "C", globals.gHtmlSpans[num]);
            if (limit === 10000) break;
            ++limit;
          }
          text = text.replace("¨C" + i + "C", repText);
        }

        text = globals.converter._dispatch("unhashHTMLSpans.after", text, {}, globals);
        return text;
      },
    );
  } catch {
    // subParser API may vary by showdown version
  }
}

function getConverter(): Converter {
  if (!_converter) {
    _converter = new showdown.Converter({
      emoji: true,
      literalMidWordUnderscores: true,
      parseImgDimensions: true,
      tables: true,
      underline: true,
      simpleLineBreaks: true,
      strikethrough: true,
      disableForced4SpacesIndentedSublists: true,
      extensions: markdownUnderscoreExt(),
    });
    addShowdownPatch(_converter);
  }
  return _converter;
}

export interface RenderMarkdownOpts {
  scopeId?: string;
  blockExternalMedia?: boolean;
  highlightDialogue?: boolean;
  autoFixMarkdown?: boolean;
}

const STYLE_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

function scopeCss(css: string, scopeId: string, blockExternalMedia: boolean): string {
  let ast: CssStylesheetAST;
  try {
    ast = parse(css, { silent: true });
  } catch {
    return "";
  }

  const rules = ast.stylesheet.rules;
  const filtered: CssAtRuleAST[] = [];

  for (const rule of rules) {
    const t = rule.type as string;
    if (t === "import" || t === "charset" || t === "namespace") continue;
    walkRule(rule);
    filtered.push(rule);
  }

  ast.stylesheet.rules = filtered;
  return stringify(ast, { compress: true });

  function walkRule(node: CssAtRuleAST | CssDeclarationAST) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n = node as any;
    const t = n.type as string;
    if (t === "declaration" || t === "comment") return;

    if (t === "rule" || t === "page") {
      const r = node as CssRuleAST;
      if (r.selectors) {
        r.selectors = r.selectors.map((sel) => scopeSelector(sel, scopeId));
      }
    }

    if (blockExternalMedia && Array.isArray(n.declarations)) {
      for (const decl of n.declarations as CssDeclarationAST[]) {
        if (decl.value) {
          decl.value = decl.value.replace(/url\(\s*["']?https?:\/\/[^)]*["']?\s*\)/gi, "url()");
        }
      }
    }

    if (Array.isArray(n.rules)) {
      for (const child of n.rules) walkRule(child);
    }

    if (Array.isArray(n.keyframes)) {
      for (const child of n.keyframes) walkRule(child);
    }
  }
}

function scopeSelector(sel: string, scopeId: string): string {
  const trimmed = sel.trim();

  // Namespace class selectors so they match the DOMPurify custom- rewrite
  const namespaced = trimmed.replace(/\.([\w-]+)/g, (_: string, className: string) => {
    if (
      className.startsWith("custom-") ||
      className.startsWith("fa-") ||
      className.startsWith("note-") ||
      className === "monospace" ||
      className.startsWith("rt-")
    ) {
      return `.${className}`;
    }
    return `.custom-${className}`;
  });

  if (trimmed === ":root" || trimmed === "html" || trimmed === "body" || trimmed === "*") {
    return `.${scopeId}`;
  }
  return `.${scopeId} ${namespaced}`;
}

function wrapQuotes(text: string): string {
  // Stash double quotes inside HTML tags to prevent matching them as dialogue
  text = text.replace(/<([^>]+)>/g, (_: string, contents: string) => {
    return "<" + contents.replace(/"/g, "\ufffe") + ">";
  });

  text = text.replace(
    /<style>[\s\S]*?<\/style>|```[\s\S]*?```|~~~[\s\S]*?~~~|``[\s\S]*?``|`[\s\S]*?`|(".*?")|(\u201C.*?\u201D)|(\u00AB.*?\u00BB)|(\u300C.*?\u300D)|(\u300E.*?\u300F)|(\uFF02.*?\uFF02)/gim,
    (_match, p1, p2, p3, p4, p5, p6) => {
      if (p1) return `<q>"${p1.slice(1, -1)}"</q>`;
      if (p2) return `<q>${p2}</q>`;
      if (p3) return `<q>${p3}</q>`;
      if (p4) return `<q>${p4}</q>`;
      if (p5) return `<q>${p5}</q>`;
      if (p6) return `<q>${p6}</q>`;
      return _match;
    },
  );

  // Restore stashed quotes inside tags
  text = text.replace(/\ufffe/g, '"');

  return text;
}

function fixMarkdown(text: string, forDisplay: boolean): string {
  const format = /([*_]{1,2})([\s\S]*?)\1/gm;
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;

  while ((match = format.exec(text)) !== null) {
    matches.push(match);
  }

  let newText = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const matchText = matches[i][0];
    const replacementText = matchText.replace(
      /(\*|_)([\t \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]+)|([\t \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]+)(\*|_)/g,
      "$1$4",
    );
    newText =
      newText.slice(0, matches[i].index) +
      replacementText +
      newText.slice(matches[i].index + matchText.length);
  }

  if (!forDisplay) return newText;

  const splitText = newText.split("\n");
  for (let index = 0; index < splitText.length; index++) {
    const line = splitText[index];
    const charsToCheck = ["*", '"'];
    for (const char of charsToCheck) {
      if (line.includes(char) && isOdd(countOccurrences(line, char))) {
        splitText[index] = line.trimEnd() + char;
      }
    }
  }

  return splitText.join("\n");
}

function addCopyToCodeBlocks(html: string): string {
  if (typeof window === "undefined") return html;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const codeBlocks = tpl.content.querySelectorAll("pre code");
  for (const code of codeBlocks) {
    const pre = code.parentElement;
    if (!pre || pre.classList.contains("code-copy-wrapper")) continue;

    const wrapper = document.createElement("div");
    wrapper.className = "code-copy-wrapper";

    const btn = document.createElement("button");
    btn.className = "code-copy-button";
    btn.textContent = "Copy";
    btn.setAttribute("data-code-copy", "");

    pre.replaceWith(wrapper);
    wrapper.appendChild(btn);
    wrapper.appendChild(pre);
  }
  return tpl.innerHTML;
}

export function renderMarkdown(content: string, opts?: RenderMarkdownOpts): string {
  if (typeof window === "undefined") return "";

  const scopeId = opts?.scopeId;
  const blockExternalMedia = opts?.blockExternalMedia ?? false;
  _blockExternalMedia = blockExternalMedia;

  let text = content;

  if (opts?.autoFixMarkdown) {
    text = fixMarkdown(text, true);
  }

  if (opts?.highlightDialogue) {
    text = wrapQuotes(text);
  }

  let html = getConverter().makeHtml(text);

  // Stash/restore newlines inside code blocks — prevents Firefox from expanding <br>s
  html = html.replace(/<code(.*)>[\s\S]*?<\/code>/g, (match) => {
    return match.replace(/\n/gm, "\x00");
  });
  // Restore stashed newlines (split/join avoids no-control-regex lint on /\u0000/)
  html = html.split("\x00").join("\n");

  html = html.trim();

  const scopedCss: string[] = [];
  if (scopeId) {
    html = html.replace(STYLE_RE, (_, cssText: string) => {
      const scoped = scopeCss(cssText, scopeId, blockExternalMedia);
      if (scoped) scopedCss.push(scoped);
      return "";
    });
  }

  const purgeCfg: DOMPurifyConfig = {
    ADD_ATTR: ["color"],
    MESSAGE_SANITIZE: true,
  } as DOMPurifyConfig;

  const bodyHtml: string = DOMPurify.sanitize(html, purgeCfg);
  const withCopyButtons = addCopyToCodeBlocks(bodyHtml);

  if (scopedCss.length > 0) {
    const safeCss = scopedCss.join("\n").replace(/<\/(style|script)/gi, "<\\/$1");
    return `<style class="rt-scoped">${safeCss}</style>${withCopyButtons}`;
  }

  return withCopyButtons;
}

function isOdd(n: number): boolean {
  return n % 2 !== 0;
}

function countOccurrences(text: string, sub: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(sub, pos)) !== -1) {
    count++;
    pos += sub.length;
  }
  return count;
}

const FENCE_LINE_RE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Replace delimiters that must not participate in balancing with spaces:
 * backslash-escaped characters and everything inside inline code spans.
 */
function maskInlineCode(line: string): string {
  let out = "";
  let i = 0;
  let fence = 0; // active backtick run length; 0 = not inside code
  while (i < line.length) {
    const ch = line[i];
    if (ch === "\\" && i + 1 < line.length) {
      out += "  ";
      i += 2;
      continue;
    }
    if (ch === "`") {
      let n = 0;
      while (line[i + n] === "`") n++;
      if (fence === 0) fence = n;
      else if (n >= fence) fence = 0;
      out += " ".repeat(n);
      i += n;
      continue;
    }
    out += fence === 0 ? ch : " ";
    i++;
  }
  return out;
}

/**
 * Return the closing delimiters needed to balance emphasis/strikethrough
 * openers in a single line. Only left-flanking runs open; a following
 * matching run closes the innermost opener. Returns the closers in
 * innermost-first order, or "" when the line is balanced.
 */
function unmatchedEmphasis(masked: string): string {
  const stack: Array<{ ch: string; count: number }> = [];
  let i = 0;
  while (i < masked.length) {
    const ch = masked[i];
    if (ch !== "*" && ch !== "_" && ch !== "~") {
      i++;
      continue;
    }
    let n = 0;
    while (masked[i + n] === ch) n++;
    const next = masked[i + n];
    const prev = i > 0 ? masked[i - 1] : "";
    const canOpen =
      next !== undefined && !/\s/.test(next) && (ch !== "_" || i === 0 || /[\s([{>]/.test(prev));
    const canClose = /\S/.test(prev);

    if (ch === "~") {
      // `~~` is strikethrough; `~~~` fences are handled by the caller.
      if (n === 2) {
        const top = stack[stack.length - 1];
        if (top && top.ch === "~" && canClose) stack.pop();
        else if (canOpen) stack.push({ ch: "~", count: 2 });
      }
      i += n;
      continue;
    }

    const top = stack[stack.length - 1];
    if (top && top.ch === ch && canClose) stack.pop();
    else if (canOpen) stack.push({ ch, count: n });
    i += n;
  }

  return stack
    .slice()
    .reverse()
    .map((d) => d.ch.repeat(d.count))
    .join("");
}

function balanceLine(line: string): string {
  const masked = maskInlineCode(line);
  let suffix = unmatchedEmphasis(masked);
  if (isOdd(countOccurrences(masked, '"'))) suffix += '"';
  return suffix.length > 0 ? line.trimEnd() + suffix : line;
}

/**
 * Close markdown delimiters that are still open in a partial (streaming)
 * buffer so the renderer receives well-formed input.
 *
 * Code spans and backslash escapes are ignored, list bullets are not
 * mistaken for emphasis, fenced blocks are closed on their own lines, and
 * multi-character openers (`**`, `***`, `~~`) are closed with a matching
 * run. `isFinal` short-circuits: complete text is returned untouched.
 */
export function balanceMarkdown(text: string, isFinal: boolean): string {
  if (isFinal) return text;

  const out: string[] = [];
  let openFence: string | null = null;

  for (const line of text.split("\n")) {
    const fence = FENCE_LINE_RE.exec(line);
    if (openFence !== null) {
      out.push(line);
      if (fence && fence[1][0] === openFence[0] && fence[1].length >= openFence.length) {
        openFence = null;
      }
      continue;
    }
    if (fence) {
      openFence = fence[1];
      out.push(line);
      continue;
    }
    out.push(balanceLine(line));
  }

  if (openFence !== null) out.push(openFence);
  return out.join("\n");
}
