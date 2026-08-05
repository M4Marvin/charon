import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function SectionHeader({ title, description, actions }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-heading text-[--sea-ink]">{title}</p>
        {description ? <p className="text-[11px] text-[--sea-ink-soft]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}
