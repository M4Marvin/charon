/**
 * A simple monotonic ID generator.
 * For distributed or persistent IDs, use UUIDs instead.
 */
export function createIdGenerator(start = 0) {
  let next = start;
  return () => next++;
}
