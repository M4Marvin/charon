import { Converter } from "showdown";
import DOMPurify from "dompurify";
import type { Config as DOMPurifyConfig } from "dompurify";
import { parse, stringify } from "@adobe/css-tools";
import type { CssAtRuleAST, CssDeclarationAST, CssRuleAST, CssStylesheetAST } from "@adobe/css-tools";

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

  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (!_blockExternalMedia) return;
    if (data.attrName === "src" || data.attrName === "srcset") {
      if (/^https?:\/\//i.test(data.attrValue)) {
        data.keepAttr = false;
      }
    }
  });
}

registerDOHooks();

let _converter: Converter | null = null;

function getConverter(): Converter {
  if (!_converter) {
    _converter = new Converter({
      emoji: true,
      literalMidWordUnderscores: true,
      parseImgDimensions: true,
      tables: true,
      underline: true,
      simpleLineBreaks: true,
      strikethrough: true,
      disableForced4SpacesIndentedSublists: true,
    });
  }
  return _converter;
}

export interface RenderMarkdownOpts {
  scopeId?: string;
  blockExternalMedia?: boolean;
  highlightDialogue?: boolean;
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
  if (trimmed === ":root" || trimmed === "html" || trimmed === "body" || trimmed === "*") {
    return `.${scopeId}`;
  }
  return `.${scopeId} ${trimmed}`;
}

export function renderMarkdown(content: string, opts?: RenderMarkdownOpts): string {
  if (typeof window === "undefined") return "";

  const scopeId = opts?.scopeId;
  const blockExternalMedia = opts?.blockExternalMedia ?? false;
  _blockExternalMedia = blockExternalMedia;

  let html = getConverter().makeHtml(content);

  const scopedCss: string[] = [];
  if (scopeId) {
    html = html.replace(STYLE_RE, (_, cssText: string) => {
      const scoped = scopeCss(cssText, scopeId, blockExternalMedia);
      if (scoped) scopedCss.push(scoped);
      return "";
    });
  }

  const purgeCfg: DOMPurifyConfig = {};
  if (blockExternalMedia) {
    purgeCfg.FORBID_TAGS = ["video", "audio", "source", "embed", "iframe", "object"];
  }

  const bodyHtml: string = DOMPurify.sanitize(html, purgeCfg);

  const finalHtml = opts?.highlightDialogue ? highlightDialogue(bodyHtml) : bodyHtml;

  if (scopedCss.length > 0) {
    const safeCss = scopedCss.join("\n").replace(/<\/(style|script)/gi, "<\\/$1");
    return `<style class="rt-scoped">${safeCss}</style>${finalHtml}`;
  }

  return finalHtml;
}

const DIALOGUE_RE = /"[^"]*"/g;
const SKIP_TAGS = new Set(["code", "pre", "style", "script"]);

function highlightDialogue(html: string): string {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  walkElement(tpl.content);
  return tpl.innerHTML;
}

function walkElement(el: Element | DocumentFragment) {
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 1) {
      const tag = (child as Element).tagName.toLowerCase();
      if (!SKIP_TAGS.has(tag)) walkElement(child as Element);
    } else if (child.nodeType === 3) {
      const text = child.textContent || "";
      if (DIALOGUE_RE.test(text)) {
        const frag = wrapDialogue(text);
        if (frag) child.parentNode?.replaceChild(frag, child);
      }
    }
  }
}

function wrapDialogue(text: string): DocumentFragment | null {
  const frag = document.createDocumentFragment();
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let found = false;

  DIALOGUE_RE.lastIndex = 0;
  while ((match = DIALOGUE_RE.exec(text)) !== null) {
    found = true;
    if (match.index > lastIndex) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    const span = document.createElement("span");
    span.className = "rt-dialogue";
    span.textContent = match[0];
    frag.appendChild(span);
    lastIndex = DIALOGUE_RE.lastIndex;
  }

  if (!found) return null;

  if (lastIndex < text.length) {
    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  return frag;
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

export function balanceMarkdown(text: string, isFinal: boolean): string {
  if (isFinal) return text;
  const chars = ["*", '"', "```", "~~~"];
  let result = text;
  for (const c of chars) {
    if (isOdd(countOccurrences(result, c))) {
      const sep = c.length > 1 ? "\n" : "";
      result = result.trimEnd() + sep + c;
    }
  }
  return result;
}
