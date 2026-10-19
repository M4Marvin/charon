import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ModelDefaultsFields } from "@/components/ai/ModelDefaultsFields";
import { SettingsCard } from "@/components/settings/settings-ui";
import { SectionHeader } from "../section-header";

interface SectionProps {
  chatId: string;
  onClose: () => void;
}

export function ModelSection({ onClose }: SectionProps) {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Model & preset"
        description="The provider, model, and preset used by every chat."
      />

      <ModelDefaultsFields />

      <SettingsCard>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-1">Manage AI setup</p>
            <p className="mt-0.5 text-xs text-2">
              Providers and presets are shared across all chats.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-9" asChild>
              <Link to="/settings/providers" onClick={onClose}>
                Providers
                <ArrowUpRight className="size-3.5" data-icon="inline-end" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-9" asChild>
              <Link to="/settings/presets" onClick={onClose}>
                Presets
                <ArrowUpRight className="size-3.5" data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
