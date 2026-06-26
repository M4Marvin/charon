import { RichText } from "@/components/RichText";

export function MarkdownContent({ content }: { content: string }) {
  if (!content) return null;
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-heading prose-code:font-mono prose-pre:font-mono prose-pre:bg-muted/60 prose-pre:border prose-pre:border-border">
      <RichText content={content} />
    </div>
  );
}
