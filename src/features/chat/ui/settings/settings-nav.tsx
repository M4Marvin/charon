import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getVisibleNavGroups, type SettingsSection } from "./settings-nav-model";

export type { SettingsSection } from "./settings-nav-model";

interface SettingsNavProps {
  sections: SettingsSection[];
  activeId: string | null;
  onChange: (id: string) => void;
}

export function SettingsNav({ sections, activeId, onChange }: SettingsNavProps) {
  const groups = getVisibleNavGroups(sections);

  return (
    <nav
      aria-label="Settings sections"
      className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-subtle py-2 scrollbar-thin sm:w-44"
    >
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-0.5">
          <p className="hidden px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wider text-3 sm:block">
            {group.label}
          </p>
          {group.items.map((s) => (
            <Tooltip key={s.id} delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onChange(s.id)}
                  className={cn(
                    "flex min-h-9 items-center justify-center gap-2.5 rounded-lg px-2 py-2 text-xs transition-colors focus-ring sm:mr-1 sm:justify-start",
                    s.secondary ? "sm:ml-5" : "sm:ml-1",
                    activeId === s.id
                      ? "bg-(--lagoon)/15 text-(--lagoon)"
                      : "text-(--sea-ink-soft) hover:bg-raised hover:text-(--sea-ink)",
                  )}
                  aria-current={activeId === s.id ? "true" : undefined}
                  aria-label={s.label}
                >
                  <s.icon className="size-4 shrink-0" />
                  <span className="hidden truncate sm:inline">{s.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs sm:hidden">
                {s.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      ))}
    </nav>
  );
}
