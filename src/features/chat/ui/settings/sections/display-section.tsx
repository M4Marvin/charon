import { useRichTextSettings } from "@/lib/richtext-settings";
import { Switch } from "@/components/ui/switch";
import { Field, FieldLabel } from "@/components/ui/field";
import { SectionHeader } from "../section-header";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
}

function DisplayToggle({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal" className="items-start justify-between gap-4 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <FieldLabel htmlFor={id} className="text-sm text-1 cursor-pointer">
          {label}
        </FieldLabel>
        <p id={`${id}-description`} className="text-xs text-2">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-describedby={`${id}-description`}
      />
    </Field>
  );
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
      <SectionHeader
        title="Display"
        description="Appearance options saved in this browser."
        scope="browser"
      />

      <div className="flex flex-col divide-y divide-subtle">
        <DisplayToggle
          id="ds-highlight"
          label="Highlight dialogue"
          description="Tint quoted speech in messages."
          checked={highlightDialogue}
          onCheckedChange={setHighlightDialogue}
        />
        <DisplayToggle
          id="ds-markdown"
          label="Auto-fix markdown"
          description="Repair common formatting issues in messages."
          checked={autoFixMarkdown}
          onCheckedChange={setAutoFixMarkdown}
        />
        <DisplayToggle
          id="ds-media"
          label="Block external media"
          description="Don't load remote images or media in messages."
          checked={blockExternalMedia}
          onCheckedChange={setBlockExternalMedia}
        />
      </div>
    </div>
  );
}
