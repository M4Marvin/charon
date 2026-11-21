/**
 * Field addressing for character cards: `data.name`,
 * `data.alternate_greetings[2]`, `data.character_book.entries[0].keys[1]`.
 */
export type Segment = string | number;

export function parsePath(path: string): Segment[] {
  const segments: Segment[] = [];
  for (const part of path.split(".")) {
    const match = part.match(/^([^[\]]*)((?:\[\d+\])*)$/);
    if (!match) throw new Error(`bad path: ${path}`);
    if (match[1]) segments.push(match[1]);
    for (const index of match[2].matchAll(/\[(\d+)\]/g)) segments.push(Number(index[1]));
  }
  if (!segments.length) throw new Error(`bad path: ${path}`);
  return segments;
}

export function getPath(root: Record<string, unknown>, segments: Segment[]): unknown {
  let node: unknown = root;
  for (const segment of segments) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<Segment, unknown>)[segment];
  }
  return node;
}

export function setPath(root: Record<string, unknown>, segments: Segment[], value: unknown): void {
  let node: Record<string, unknown> = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const current = node[segment];
    if (current === null || typeof current !== "object") {
      node[segment] = typeof segments[i + 1] === "number" ? [] : {};
    }
    node = node[segment] as Record<string, unknown>;
  }
  node[segments[segments.length - 1]] = value;
}

export function unsetPath(root: Record<string, unknown>, segments: Segment[]): void {
  const parent = getPath(root, segments.slice(0, -1));
  if (parent && typeof parent === "object")
    delete (parent as Record<string, unknown>)[segments[segments.length - 1]];
}

/** Parse a textual value: JSON when it parses, the raw string otherwise. */
export function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
