import { MessageSquare, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODE_LABELS, type SettingsMode } from "./settings-nav-model";

const MODE_ICONS = { chat: MessageSquare, defaults: Layers } as const;

export function SettingsModeSwitch({
  mode,
  onChange,
}: {
  mode: SettingsMode;
  onChange: (mode: SettingsMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Settings scope"
      className="flex h-11 rounded-xl border border-subtle bg-surface/70 p-0.5"
    >
      {(Object.keys(MODE_LABELS) as SettingsMode[]).map((id) => {
        const Icon = MODE_ICONS[id];
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-1.5 text-[12px] font-medium transition-colors focus-ring active:scale-[0.98] sm:text-[13px]",
              active
                ? "bg-brand/15 text-brand shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--brand),transparent_75%)]"
                : "text-2 hover:bg-(--bg-hover) hover:text-1",
            )}
          >
            <Icon className="hidden size-3.5 shrink-0 min-[380px]:inline" aria-hidden="true" />
            {MODE_LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}
