import type { CharacterDataV2 } from "@/lib/st-core/character";

/**
 * Derive a display name from a card's source slug.
 *
 * Exporters may store a canonical slug as `extensions.<source>.full_path`
 * (e.g. "Author/example-character-656d8b705cfb"). The trailing 12-hex
 * segment is an id suffix, not part of the title. Falls back to
 * `data.name.trim()` when no slug is present or it humanizes to nothing.
 */
export function deriveDisplayName(data: CharacterDataV2): string {
  const source = Object.values(data.extensions ?? {}).find(
    (value): value is { full_path: string } =>
      typeof value === "object" &&
      value !== null &&
      typeof (value as { full_path?: unknown }).full_path === "string",
  );

  const raw = source?.full_path.trim();
  if (raw) {
    const slug = raw.split("/").pop() ?? "";
    const words = slug
      .replace(/[0-9a-f]{12}$/i, "")
      .replace(/[_-]+/g, "-")
      .split("-")
      .filter((word) => word.length > 0);
    const humanized = words
      .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1) : word))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (humanized !== "") {
      return humanized;
    }
  }

  return data.name.trim();
}
