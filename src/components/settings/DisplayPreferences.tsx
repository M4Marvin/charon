import { useRichTextSettings } from "@/lib/richtext-settings";
import { Switch } from "@/components/ui/switch";
import { SettingsCard, SettingsCardRows, SettingsRow } from "@/components/settings/settings-ui";

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
    <SettingsRow label={label} description={description} htmlFor={id}>
      <div className="flex size-11 items-center justify-center">
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-describedby={`${id}-description`}
        />
      </div>
    </SettingsRow>
  );
}

export function DisplayPreferences({ onChanged }: { onChanged?: () => void }) {
  const {
    blockExternalMedia,
    setBlockExternalMedia,
    highlightDialogue,
    setHighlightDialogue,
    autoFixMarkdown,
    setAutoFixMarkdown,
  } = useRichTextSettings();

  const update = (setter: (value: boolean) => void) => (value: boolean) => {
    setter(value);
    onChanged?.();
  };

  return (
    <SettingsCard>
      <SettingsCardRows>
        <DisplayToggle
          id="ds-highlight"
          label="Highlight dialogue"
          description="Tint quoted speech in messages."
          checked={highlightDialogue}
          onCheckedChange={update(setHighlightDialogue)}
        />
        <DisplayToggle
          id="ds-markdown"
          label="Auto-fix markdown"
          description="Repair common formatting issues in messages."
          checked={autoFixMarkdown}
          onCheckedChange={update(setAutoFixMarkdown)}
        />
        <DisplayToggle
          id="ds-media"
          label="Block external media"
          description="Don't load remote images or media in messages."
          checked={blockExternalMedia}
          onCheckedChange={update(setBlockExternalMedia)}
        />
      </SettingsCardRows>
    </SettingsCard>
  );
}
