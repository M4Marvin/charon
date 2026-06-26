import { useEffect, useMemo, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";

export function RichText({ content }: { content: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const html = useMemo(() => (mounted ? renderMarkdown(content) : ""), [content, mounted]);

  if (!html) return null;

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
