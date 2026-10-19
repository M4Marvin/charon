import { useEffect, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import type { SettingsSection } from "./settings-nav-model";

export type { SettingsSection } from "./settings-nav-model";

interface SettingsNavProps {
  sections: SettingsSection[];
  activeId: string | null;
  onChange: (id: string) => void;
  open?: boolean;
}

export function SettingsNav({ sections, activeId, onChange, open }: SettingsNavProps) {
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined" || !window.matchMedia("(min-width: 1024px)").matches) return;
    const active = activeIdRef.current;
    if (active) buttonsRef.current.get(active)?.focus();
  }, [open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = Math.max(
      0,
      sections.findIndex((section) => section.id === activeId),
    );
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % sections.length;
    if (event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + sections.length) % sections.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = sections.length - 1;
    const next = sections[nextIndex];
    if (!next) return;
    onChange(next.id);
    buttonsRef.current.get(next.id)?.focus();
  };

  return (
    <nav
      aria-label="Settings sections"
      onKeyDown={handleKeyDown}
      className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3 scrollbar-thin"
    >
      {sections.map((s) => (
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
            "relative flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-[13px] transition-colors focus-ring",
            activeId === s.id
              ? "bg-brand/15 text-brand before:absolute before:top-2.5 before:bottom-2.5 before:left-0 before:w-0.5 before:rounded-full before:bg-brand"
              : "text-2 hover:bg-(--bg-hover) hover:text-1",
          )}
          aria-current={activeId === s.id ? "true" : undefined}
        >
          <s.icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{s.label}</span>
        </button>
      ))}
    </nav>
  );
}
