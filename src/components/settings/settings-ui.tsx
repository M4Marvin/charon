import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("overflow-hidden rounded-2xl border border-subtle bg-surface/60", className)}
    >
      {children}
    </div>
  );
}

export function SettingsCardRows({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("divide-y divide-subtle", className)}>{children}</div>;
}

export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
  className,
}: {
  label: string;
  description?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-14 items-center justify-between gap-4 px-4 py-3", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="cursor-pointer text-[13px] font-medium text-1">
            {label}
          </label>
        ) : (
          <p className="text-[13px] font-medium text-1">{label}</p>
        )}
        {description ? <p className="text-xs leading-relaxed text-2">{description}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}
