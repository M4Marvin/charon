import { DisplayPreferences } from "@/components/settings/DisplayPreferences";
import { SectionHeader } from "../section-header";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
}

export function DisplaySection(_props: SectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Display"
        description="Appearance options saved in this browser."
        scope="browser"
      />
      <DisplayPreferences />
    </div>
  );
}
