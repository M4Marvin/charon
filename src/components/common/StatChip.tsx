import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface StatChipProps {
  icon: LucideIcon;
  value: ReactNode;
  label: string;
}

export function StatChip({ icon: Icon, value, label }: StatChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-2 text-xs">
      <Icon className="size-3.5 shrink-0" />
      <span className="font-medium tabular-nums">{value}</span>
      <span>{label}</span>
    </span>
  );
}
