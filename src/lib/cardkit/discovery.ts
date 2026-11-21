import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import type { CardPackage, Greeting } from "./types.js";

const MARKDOWN_IMAGE = /!\[[^\]]*\]\(([^)\s]+)/g;
const HTML_IMAGE = /<img[^>]+src="([^"]+)"/g;
const CSS_IMAGE = /url\(\s*['"]?([^)'"]+?)['"]?\s*\)/g;

/** Image URLs a chub frontend would load: markdown, <img>, and CSS backgrounds. */
function cssImage(url: string): boolean {
  return (
    !url.startsWith("data:") && !/\.css(\?|$)/.test(url) && !url.includes("fonts.googleapis.com")
  );
}

export function imagesIn(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(MARKDOWN_IMAGE)) found.push(match[1]);
  for (const match of text.matchAll(HTML_IMAGE)) found.push(match[1]);
  for (const match of text.matchAll(CSS_IMAGE)) if (cssImage(match[1])) found.push(match[1]);
  return found;
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

/** Card directories under a root: anything with a page or a character bible. */
export async function findCards(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const dirs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const dir = join(root, entry.name);
    const [page, bible] = await Promise.all([
      stat(join(dir, "description.html")).catch(() => null),
      stat(join(dir, "personality.md")).catch(() => null),
    ]);
    if (page || bible) dirs.push(dir);
  }
  return dirs.sort();
}

async function readGreetings(dir: string, firstMessage: string | null): Promise<Greeting[]> {
  const combined = await readOptional(join(dir, "greetings.md"));
  if (combined) {
    const sections = combined.split(/^\s*===\s*$/m).map((text) => text.trim());
    const header = sections[0].startsWith("#") ? 1 : 0;
    return sections
      .slice(header)
      .filter(Boolean)
      .map((text, index) => ({ id: `greetings.md#${index + 2}`, text, images: imagesIn(text) }));
  }

  const files = await readdir(join(dir, "greetings")).catch(() => []);
  const md = files.filter((file) => file.endsWith(".md")).sort();
  const greetings: Greeting[] = [];
  for (const file of md) {
    const text = (await readOptional(join(dir, "greetings", file)))?.trim();
    if (!text) continue;
    const isFirst = !firstMessage && file.startsWith("01");
    greetings.push({
      id: isFirst ? "first_message" : `greetings/${file}`,
      text,
      images: imagesIn(text),
    });
  }
  return greetings;
}

export async function loadCard(dir: string): Promise<CardPackage> {
  const [rawPage, personality, rawTagline, metadata, firstMessage] = await Promise.all([
    readOptional(join(dir, "description.html")),
    readOptional(join(dir, "personality.md")),
    readOptional(join(dir, "tagline.txt")),
    readOptional(join(dir, "metadata.md")),
    readOptional(join(dir, "first_message.md")),
  ]);

  const tagline = rawTagline?.trim() ?? metadata?.match(/<--[^\n]*-->/)?.[0].trim() ?? null;

  const greetings = await readGreetings(dir, firstMessage);
  if (firstMessage) {
    const text = firstMessage.trim();
    greetings.unshift({ id: "first_message", text, images: imagesIn(text) });
  }

  const page = rawPage ?? null;
  const images = new Set<string>();
  for (const url of imagesIn(page ?? "")) images.add(url);
  for (const greeting of greetings) for (const url of greeting.images) images.add(url);

  return {
    dir,
    name: basename(dir),
    page,
    personality,
    tagline,
    greetings,
    images: [...images],
  };
}
