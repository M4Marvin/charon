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

/**
 * Import failures come out of the PNG parser as card-spec jargon ("No PNG
 * metadata."). Translate them into something a person can act on.
 */
export function friendlyImportError(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (/no png metadata|no character data|not a character card|\b(chara|ccv3)\b/i.test(raw)) {
    return "That PNG doesn't contain a character card. Export the card from its source, or try another file.";
  }
  return friendlyLoadError(error, "Couldn't read that file. Try a character card PNG.");
}
