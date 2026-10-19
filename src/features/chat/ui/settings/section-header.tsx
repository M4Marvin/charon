import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, actions, className }: SectionHeaderProps) {
  return (
    <div
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="sr-only text-[17px] font-semibold tracking-[-0.01em] text-1 lg:not-sr-only">
          {title}
        </h3>
        {description ? (
          <p className="max-w-prose text-[13px] leading-relaxed text-2">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:w-full">{actions}</div>
      ) : null}
    </div>
  );
}
