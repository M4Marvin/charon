export function uploadsUrl(
  stored: string | null | undefined,
): string | null {
  if (!stored) return null;
  return `/${stored.replace(/\.(png|jpe?g|webp)$/i, "")}`;
}
