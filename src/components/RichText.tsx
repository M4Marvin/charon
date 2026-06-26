import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import morphdom from "morphdom";
import { renderMarkdown } from "@/lib/markdown";
import { useRichTextSettings } from "@/lib/richtext-settings";

const BLOCK_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "table",
  "pre",
  "blockquote",
  "div",
  "img",
  "figure",
  "figcaption",
]);

export function RichText({ content }: { content: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const scopeId = `rt-${useId().replace(/:/g, "")}`;
  const ref = useRef<HTMLDivElement>(null);
  const { blockExternalMedia, highlightDialogue } = useRichTextSettings();

  const html = useMemo(
    () =>
      mounted ? renderMarkdown(content, { scopeId, blockExternalMedia, highlightDialogue }) : "",
    [content, mounted, scopeId, blockExternalMedia, highlightDialogue],
  );

  const onNodeAdded = useCallback((node: Node) => {
    if (node.nodeType === 1) {
      const el = node as HTMLElement;
      if (BLOCK_TAGS.has(el.tagName.toLowerCase())) {
        el.classList.add("rt-msg-in");
      }
    }
  }, []);

  useEffect(() => {
    if (!html || !ref.current) return;
    const toDiv = document.createElement("div");
    toDiv.innerHTML = html;
    morphdom(ref.current, toDiv, {
      childrenOnly: true,
      onBeforeElUpdated: (fromEl, toEl) => (fromEl.isEqualNode(toEl) ? false : true),
      onNodeAdded,
    });
  }, [html, onNodeAdded]);

  if (!mounted || !html) return null;

  return <div ref={ref} className={scopeId} />;
}
