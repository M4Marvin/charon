import { createFileRoute } from "@tanstack/react-router";
import { DisplayPreferences } from "@/components/settings/DisplayPreferences";

export const Route = createFileRoute("/settings/preferences")({
  component: PreferencesPage,
});

function PreferencesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-title">Display preferences</h2>
        <p className="text-2 text-sm">These appearance options are saved in this browser.</p>
      </div>
      <DisplayPreferences />
    </div>
  );
}
