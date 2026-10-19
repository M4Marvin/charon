import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SettingsSection } from "./settings-nav-model";

interface SettingsSectionPickerProps {
  sections: SettingsSection[];
  activeId: string | null;
  onChange: (id: string) => void;
}

export function SettingsSectionPicker({
  sections,
  activeId,
  onChange,
}: SettingsSectionPickerProps) {
  const active = sections.find((section) => section.id === activeId) ?? sections[0];

  if (!active) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-11 w-full justify-between gap-3 bg-surface/70 px-3 text-left"
          aria-label={`Choose settings section. Current: ${active.label}`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <active.icon className="size-4 shrink-0 text-2" aria-hidden="true" />
            <span className="truncate text-[13px] font-medium">{active.label}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-2" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {sections.map((section) => (
          <DropdownMenuItem
            key={section.id}
            className="min-h-11"
            onSelect={() => onChange(section.id)}
          >
            <section.icon className="size-4 shrink-0 text-2" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{section.label}</span>
            {section.id === active.id ? (
              <Check className="size-4 shrink-0 text-brand" aria-hidden="true" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
