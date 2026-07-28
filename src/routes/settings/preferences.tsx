import { createFileRoute } from "@tanstack/react-router";
import { Switch } from "@/components/ui/switch";
import { useRichTextSettings } from "@/lib/richtext-settings";

export const Route = createFileRoute("/settings/preferences")({
  component: PreferencesPage,
});

function PreferencesPage() {
  const {
    blockExternalMedia,
    setBlockExternalMedia,
    highlightDialogue,
    setHighlightDialogue,
    autoFixMarkdown,
    setAutoFixMarkdown,
  } = useRichTextSettings();

  return (
    <div className="space-y-6">
      <h2 className="text-title">Display Preferences</h2>
      <div className="space-y-4">
        <label className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-surface">
          <div>
            <p className="text-sm font-medium">Block external media</p>
            <p className="text-2 text-xs">
              Prevent loading images from external URLs in chat messages.
            </p>
          </div>
          <Switch checked={blockExternalMedia} onCheckedChange={setBlockExternalMedia} />
        </label>
        <label className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-surface">
          <div>
            <p className="text-sm font-medium">Highlight dialogue</p>
            <p className="text-2 text-xs">Apply a distinct colour to quoted speech in messages.</p>
          </div>
          <Switch checked={highlightDialogue} onCheckedChange={setHighlightDialogue} />
        </label>
        <label className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-surface">
          <div>
            <p className="text-sm font-medium">Auto-fix Markdown</p>
            <p className="text-2 text-xs">
              Automatically correct common Markdown issues in messages.
            </p>
          </div>
          <Switch checked={autoFixMarkdown} onCheckedChange={setAutoFixMarkdown} />
        </label>
      </div>
    </div>
  );
}
