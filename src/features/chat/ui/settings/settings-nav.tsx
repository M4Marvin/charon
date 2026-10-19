import { useEffect, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { getVisibleNavGroups, type SettingsSection } from "./settings-nav-model";

export type { SettingsSection } from "./settings-nav-model";

interface SettingsNavProps {
  sections: SettingsSection[];
  activeId: string | null;
  onChange: (id: string) => void;
  open?: boolean;
}

export function SettingsNav({ sections, activeId, onChange, open }: SettingsNavProps) {
  const groups = getVisibleNavGroups(sections);
  const flatSections = groups.flatMap((group) => group.items);
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined" || !window.matchMedia("(min-width: 768px)").matches) return;
    const activeButton = activeId ? buttonsRef.current.get(activeId) : null;
    activeButton?.focus();
  }, [open, activeId]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = Math.max(
      0,
      flatSections.findIndex((section) => section.id === activeId),
    );
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % flatSections.length;
    if (event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + flatSections.length) % flatSections.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = flatSections.length - 1;
    const next = flatSections[nextIndex];
    if (!next) return;
    onChange(next.id);
    buttonsRef.current.get(next.id)?.focus();
  };

  return (
    <nav
      aria-label="Settings sections"
      onKeyDown={handleKeyDown}
      className="hidden w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r border-subtle py-2 scrollbar-thin md:flex"
    >
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-0.5">
          <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-2">
            {group.label}
          </p>
          {group.items.map((s) => (
            <button
              key={s.id}
              ref={(element) => {
                if (element) buttonsRef.current.set(s.id, element);
                else buttonsRef.current.delete(s.id);
              }}
              type="button"
              onClick={() => onChange(s.id)}
              tabIndex={activeId === s.id ? 0 : -1}
              aria-controls="settings-panel"
              className={cn(
                "mx-1 flex min-h-10 cursor-pointer items-center justify-start gap-2.5 rounded-lg px-2 py-2 text-[13px] transition-colors focus-ring",
                activeId === s.id
                  ? "bg-brand/15 text-brand"
                  : "text-2 hover:bg-raised hover:text-1",
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
