/**
 * Canonical not-found error contract for the character repositories. The repo
 * owns the throw; client surfaces use the predicates to discriminate a
 * genuinely deleted row from any other failure (network blip, server error),
 * which must never be reported as "no longer exists".
 */
export const CHARACTER_NOT_FOUND = "Character not found";
export const REVISION_NOT_FOUND = "Revision not found";

export function isCharacterNotFound(error: unknown): boolean {
  return error instanceof Error && error.message === CHARACTER_NOT_FOUND;
}

export function isRevisionNotFound(error: unknown): boolean {
  return error instanceof Error && error.message === REVISION_NOT_FOUND;
}
