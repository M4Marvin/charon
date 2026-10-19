import { useCallback, useState } from "react";
import { DisplayPreferences } from "@/components/settings/DisplayPreferences";
import { SectionHeader } from "../section-header";
import { useSettingsSaveStatus } from "../save-status";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
}

export function DisplaySection(_props: SectionProps) {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const onChanged = useCallback(() => setSavedAt(Date.now()), []);

  useSettingsSaveStatus("display", savedAt ? "saved" : "idle", {
    at: savedAt ?? undefined,
  });

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Display"
        description="Appearance options saved in this browser."
        scope="browser"
      />
      <DisplayPreferences onChanged={onChanged} />
    </div>
  );
}
