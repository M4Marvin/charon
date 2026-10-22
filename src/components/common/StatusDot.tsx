import { cn } from "@/lib/utils";

const tones = {
  success: "bg-success",
  muted: "bg-[var(--text-3)]",
  danger: "bg-danger",
} as const;

interface StatusDotProps {
  tone: keyof typeof tones;
  label: string;
  className?: string;
  labelClassName?: string;
}

export function StatusDot({ tone, label, className, labelClassName }: StatusDotProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className={`inline-block size-2 shrink-0 rounded-full ${tones[tone]}`}
      />
      <span className={cn("truncate text-xs", labelClassName)}>{label}</span>
    </span>
  );
}
