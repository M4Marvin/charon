import { cn } from "@/lib/utils";
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
      className="hidden w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r border-subtle py-2 scrollbar-thin md:flex"
    >
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-0.5">
          <p className="px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wider text-3">
            {group.label}
          </p>
          {group.items.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={cn(
                "mx-1 flex min-h-9 cursor-pointer items-center justify-start gap-2.5 rounded-lg px-2 py-2 text-xs transition-colors focus-ring",
                activeId === s.id
                  ? "bg-(--lagoon)/15 text-(--lagoon)"
                  : "text-(--sea-ink-soft) hover:bg-raised hover:text-(--sea-ink)",
              )}
              aria-current={activeId === s.id ? "true" : undefined}
              aria-label={s.label}
            >
              <s.icon className="size-4 shrink-0" />
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
