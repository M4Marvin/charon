/**
 * A newly created provider becomes the account default only when it is the
 * first one. Adding a second endpoint must not silently replace the provider,
 * model, or preset every chat is already using.
 */
export function shouldAdoptCreatedProvider(
  providers: ReadonlyArray<{ id: string }> | null | undefined,
): boolean {
  return (providers?.length ?? 0) === 0;
}
