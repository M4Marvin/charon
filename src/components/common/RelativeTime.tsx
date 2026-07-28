import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

export function RelativeTime({ date }: { date: Date }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <time dateTime={date.toISOString()}>{date.toLocaleDateString()}</time>;
  }

  return (
    <time dateTime={date.toISOString()}>{formatDistanceToNow(date, { addSuffix: true })}</time>
  );
}
