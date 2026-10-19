import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ModelDefaultsFields } from "@/components/ai/ModelDefaultsFields";
import { SectionHeader } from "../section-header";

interface SectionProps {
  chatId: string;
  onClose: () => void;
}

export function ModelSection({ onClose }: SectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Model & preset"
        description="The default provider, model, and preset used by every chat."
        scope="global"
      />

      <ModelDefaultsFields />

      <div className="rounded-xl border border-subtle bg-surface p-4">
        <p className="text-sm font-medium text-1">Manage AI setup</p>
        <p className="mt-1 text-xs text-2">Providers and presets are shared across all chats.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" asChild>
            <Link to="/settings/providers" onClick={onClose}>
              Providers
              <ArrowUpRight className="size-3.5" data-icon="inline-end" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" asChild>
            <Link to="/settings/presets" onClick={onClose}>
              Presets
              <ArrowUpRight className="size-3.5" data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
