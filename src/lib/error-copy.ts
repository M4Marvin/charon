/**
 * Convert transport/database errors into copy a person can act on. Settings
 * surfaces must never render "Failed to fetch" or a raw SQLite message.
 */
export function friendlyLoadError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!raw) return fallback;
  if (/failed to fetch|networkerror|load failed|fetch failed|econnrefused/i.test(raw)) {
    return "Couldn't reach the server. Check that Charon is running and try again.";
  }
  return fallback;
}
