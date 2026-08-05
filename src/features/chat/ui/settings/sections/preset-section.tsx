import { PresetManager } from "@/components/preset/PresetManager";
import { SectionHeader } from "../section-header";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
  isAdmin: boolean;
  onNavigate: (sectionId: string) => void;
}

export function PresetSection(_props: SectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title="Presets" description="Generation parameters — shared across all chats." />
      <PresetManager variant="sheet" />
    </div>
  );
}
