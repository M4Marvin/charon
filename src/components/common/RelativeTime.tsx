import { useEffect, useState } from "react";
import { formatDistance } from "date-fns";

interface RelativeTimeProps {
  date: Date;
  /** Reference time. Defaults to now. Pass a shared clock to keep rows in sync. */
  now?: Date;
  /** Short form: now, 2m, 3h, 5d, 2mo, 1y. The full phrase becomes the title. */
  compact?: boolean;
}

function compactDistance(full: string): string {
  return full
    .replace(/^less than a minute$/, "now")
    .replace(/^(about|over|almost) /, "")
    .replace(/ minutes?$/, "m")
    .replace(/ hours?$/, "h")
    .replace(/ days?$/, "d")
    .replace(/ months?$/, "mo")
    .replace(/ years?$/, "y");
}

export function RelativeTime({ date, now, compact = false }: RelativeTimeProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <time dateTime={date.toISOString()}>{date.toLocaleDateString()}</time>;
  }

  const full = formatDistance(date, now ?? new Date(), { addSuffix: true });
  const distance = formatDistance(date, now ?? new Date(), { addSuffix: false });
  return (
    <time dateTime={date.toISOString()} title={compact ? full : undefined}>
      {compact ? compactDistance(distance) : full}
    </time>
  );
}
