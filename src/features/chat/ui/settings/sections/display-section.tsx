import { useRichTextSettings } from "@/lib/richtext-settings";
import { Switch } from "@/components/ui/switch";
import { Field, FieldLabel } from "@/components/ui/field";
import { SectionHeader } from "../section-header";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
  isAdmin: boolean;
}

export function DisplaySection(_props: SectionProps) {
  const {
    blockExternalMedia,
    setBlockExternalMedia,
    highlightDialogue,
    setHighlightDialogue,
    autoFixMarkdown,
    setAutoFixMarkdown,
  } = useRichTextSettings();

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title="Display" />

      <Field className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor="ds-highlight" className="text-xs text-[--sea-ink-soft] cursor-pointer">
          Highlight dialogue
        </FieldLabel>
        <Switch
          id="ds-highlight"
          checked={highlightDialogue}
          onCheckedChange={setHighlightDialogue}
        />
      </Field>

      <Field className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor="ds-markdown" className="text-xs text-[--sea-ink-soft] cursor-pointer">
          Auto-fix markdown
        </FieldLabel>
        <Switch id="ds-markdown" checked={autoFixMarkdown} onCheckedChange={setAutoFixMarkdown} />
      </Field>

      <Field className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor="ds-media" className="text-xs text-[--sea-ink-soft] cursor-pointer">
          Block external media
        </FieldLabel>
        <Switch
          id="ds-media"
          checked={blockExternalMedia}
          onCheckedChange={setBlockExternalMedia}
        />
      </Field>
    </div>
  );
}
