import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DisplayPreferences } from "@/components/settings/DisplayPreferences";
import { useSettingsSaveStatus } from "@/features/chat/ui/settings/save-status";

export const Route = createFileRoute("/settings/preferences")({
  component: PreferencesPage,
});

function PreferencesPage() {
  const [savedAt, setSavedAt] = useState<number | undefined>(undefined);
  useSettingsSaveStatus("display", savedAt ? "saved" : "idle", { at: savedAt });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-title">Display preferences</h2>
        <p className="text-2 text-sm">These appearance options are saved in this browser.</p>
      </div>
      <DisplayPreferences onChanged={() => setSavedAt(Date.now())} />
    </div>
  );
}
