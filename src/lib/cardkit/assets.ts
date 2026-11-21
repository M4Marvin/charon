import { readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const SEARCH_DIRS = ["images/final", "images", "web", "art", "shots"];

/**
 * Map hosted image URLs to local files by basename, so a render does not
 * depend on the file server (nor on its Cloudflare in front).
 */
export async function buildAssetMap(dir: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const sub of SEARCH_DIRS) {
    const entries = await readdir(join(dir, sub), { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile() || !IMAGE_EXT.has(extname(entry.name).toLowerCase())) continue;
      map.set(entry.name, join(dir, sub, entry.name));
    }
  }
  return map;
}

/** Rewrite absolute image URLs to file:// when the card ships the same file. */
export function rewriteAssets(html: string, map: Map<string, string>): string {
  if (!map.size) return html;
  return html.replace(/https?:\/\/[^\s"'()]+/g, (url) => {
    const name = basename(url.split("?")[0]);
    const local = map.get(name);
    return local ? pathToFileURL(local).href : url;
  });
}
