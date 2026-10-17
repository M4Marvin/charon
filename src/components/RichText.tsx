import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import morphdom from "morphdom";
import { renderMarkdown } from "@/lib/markdown";
import { useRichTextSettings } from "@/lib/richtext-settings";

// Layout effects run before paint on the client; fall back to useEffect during
// SSR so React does not warn about useLayoutEffect on the server.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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

export function RichText({ content, className }: { content: string; className?: string }) {
  const [mounted, setMounted] = useState(false);
  useIsomorphicLayoutEffect(() => {
    setMounted(true);
  }, []);

  const scopeId = `rt-${useId().replace(/:/g, "")}`;
  const ref = useRef<HTMLDivElement>(null);
  const { blockExternalMedia, highlightDialogue, autoFixMarkdown } = useRichTextSettings();

  const html = useMemo(
    () =>
      mounted
        ? renderMarkdown(content, {
            scopeId,
            blockExternalMedia,
            highlightDialogue,
            autoFixMarkdown,
          })
        : "",
    [content, mounted, scopeId, blockExternalMedia, highlightDialogue, autoFixMarkdown],
  );

  const onNodeAdded = useCallback((node: Node) => {
    if (node.nodeType === 1) {
      const el = node as HTMLElement;
      if (BLOCK_TAGS.has(el.tagName.toLowerCase())) {
        el.classList.add("rt-msg-in");
      }
    }
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!html || !ref.current) return;
    const toDiv = document.createElement("div");
    toDiv.innerHTML = html;
    morphdom(ref.current, toDiv, {
      childrenOnly: true,
      onBeforeElUpdated: (fromEl, toEl) => (fromEl.isEqualNode(toEl) ? false : true),
      onNodeAdded,
    });
  }, [html, onNodeAdded]);

  useEffect(() => {
    if (!mounted) return;
    const el = ref.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest("[data-code-copy]") as HTMLElement | null;
      if (!btn) return;
      const code = btn.nextElementSibling?.querySelector("code")?.textContent ?? "";
      navigator.clipboard.writeText(code);
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = "Copy";
      }, 2000);
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, [mounted]);

  if (!mounted || !html) {
    if (!content) return null;
    // Plain-text fallback for SSR/hydration; replaced with rendered HTML in a
    // layout effect before the first client paint.
    return (
      <div
        className={[scopeId, "rt-mes-text", "whitespace-pre-wrap", className]
          .filter(Boolean)
          .join(" ")}
      >
        {content}
      </div>
    );
  }

  return (
    <div ref={ref} className={[scopeId, "rt-mes-text", className].filter(Boolean).join(" ")} />
  );
}
