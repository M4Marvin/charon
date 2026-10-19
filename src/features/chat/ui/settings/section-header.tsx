import type { ReactNode } from "react";
import { SCOPE_LABELS, type SettingsScope } from "./settings-nav-model";

interface SectionHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  scope?: SettingsScope;
}

export function SectionHeader({ title, description, actions, scope }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-headline text-(--sea-ink)">{title}</h3>
          {scope ? (
            <span className="rounded-full border border-subtle bg-surface px-2 py-0.5 text-[11px] font-medium leading-4 text-2">
              {SCOPE_LABELS[scope]}
            </span>
          ) : null}
        </div>
        {description ? <p className="text-sm text-2">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-1 sm:w-auto">{actions}</div>
      ) : null}
    </div>
  );
}
