/**
 * Canonical not-found error contract for the characters repo. The repo owns
 * the throw; client surfaces use the predicate to discriminate a genuinely
 * deleted row from any other failure (network blip, server error), which
 * must never be reported as "no longer exists".
 */
export const CHARACTER_NOT_FOUND = "Character not found";

export function isCharacterNotFound(error: unknown): boolean {
  return error instanceof Error && error.message === CHARACTER_NOT_FOUND;
}
