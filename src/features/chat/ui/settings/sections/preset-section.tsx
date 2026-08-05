import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PresetManager } from "@/components/preset/PresetManager";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
  isAdmin: boolean;
  onNavigate: (sectionId: string) => void;
}

export function PresetSection({ onNavigate }: SectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-full glass text-[--sea-ink-soft] hover:text-[--sea-ink]"
            onClick={() => onNavigate("connection")}
            aria-label="Back to Connection settings"
          >
            <Settings className="size-3.5" />
          </Button>
          <p className="text-sm font-heading text-[--sea-ink]">Presets</p>
        </div>
        <p className="text-[11px] text-[--sea-ink-soft]">
          Generation parameters — shared across all chats.
        </p>
      </div>
      <PresetManager />
    </div>
  );
}
