import { useCallback, useState } from "react";
import { DisplayPreferences } from "@/components/settings/DisplayPreferences";
import { RichText } from "@/components/RichText";
import { SectionHeader } from "../section-header";
import { useSettingsSaveStatus } from "../save-status";

const PREVIEW = `She leans closer. "You're late again."

*She laughs softly* and adds, **quietly**, "Don't tell anyone."`;

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
    <div className="flex flex-col gap-6">
      <SectionHeader title="Display" description="Appearance options saved in this browser." />

      <div className="overflow-hidden rounded-2xl border border-subtle bg-surface/60">
        <div className="flex items-center justify-between border-b border-subtle px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-2">Preview</p>
          <span className="text-[11px] text-2">Live</span>
        </div>
        <div className="bg-base/40 px-4 py-4">
          <RichText content={PREVIEW} className="text-[13px] leading-relaxed" />
        </div>
      </div>

      <DisplayPreferences onChanged={onChanged} />
    </div>
  );
}
