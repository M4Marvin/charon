import { Converter } from "showdown";
import DOMPurify from "dompurify";

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

export function renderMarkdown(content: string): string {
  if (typeof window === "undefined") return "";
  const html = getConverter().makeHtml(content);
  return DOMPurify.sanitize(html);
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
