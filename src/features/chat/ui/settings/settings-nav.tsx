import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";

export interface SettingsSection {
  id: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

interface SettingsNavProps {
  sections: SettingsSection[];
  activeId: string;
  onChange: (id: string) => void;
}

export function SettingsNav({ sections, activeId, onChange }: SettingsNavProps) {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";

  const visible = sections.filter((s) => !s.adminOnly || isAdmin);

  return (
    <nav
      className="flex w-14 shrink-0 flex-col gap-0.5 border-r border-white/5 py-2"
      aria-label="Settings sections"
    >
      {visible.map((s) => (
        <Tooltip key={s.id} delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onChange(s.id)}
              className={cn(
                "flex items-center justify-center rounded-lg mx-1 py-2 transition-colors",
                activeId === s.id
                  ? "bg-[--lagoon]/15 text-[--lagoon]"
                  : "text-[--sea-ink-soft] hover:bg-white/5 hover:text-[--sea-ink]",
              )}
              aria-current={activeId === s.id ? "page" : undefined}
              aria-label={s.label}
            >
              <s.icon className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {s.label}
          </TooltipContent>
        </Tooltip>
      ))}
    </nav>
  );
}
