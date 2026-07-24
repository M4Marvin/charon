export function uploadsUrl(
  stored: string | null | undefined,
): string | null {
  return stored ? `/${stored}` : null;
}