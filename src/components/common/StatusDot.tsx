const tones = {
  success: "bg-success",
  muted: "bg-text-3",
  danger: "bg-danger",
} as const;

interface StatusDotProps {
  tone: keyof typeof tones;
  label: string;
}

export function StatusDot({ tone, label }: StatusDotProps) {
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-label={label}>
      <span className={`inline-block size-2 rounded-full ${tones[tone]}`} />
      <span className="text-xs">{label}</span>
    </span>
  );
}
