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

/** "| Name | `Yuki` |" → "Yuki" */
export function metadataField(metadata: string | null, field: string): string | null {
  if (!metadata) return null;
  const line = metadata
    .split("\n")
    .find((l) => l.toLowerCase().includes(`| ${field.toLowerCase()}`));
  if (!line) return null;
  const cell = line.split("|")[2] ?? "";
  return cell.replace(/`/g, "").replace(/\*\*/g, "").trim() || null;
}

/** Backticked items under "## Tags". */
export function metadataTags(metadata: string | null): string[] {
  if (!metadata) return [];
  const section = metadata.split(/^## Tags/m)[1] ?? "";
  const block = section.split(/^##/m)[0] ?? "";
  return [...block.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim()).filter(Boolean);
}

export async function loadCard(dir: string): Promise<CardPackage> {
  const [rawPage, personality, rawTagline, metadata, firstMessage] = await Promise.all([
    readOptional(join(dir, "description.html")),
    readOptional(join(dir, "personality.md")),
    readOptional(join(dir, "tagline.txt")),
    readOptional(join(dir, "metadata.md")),
    readOptional(join(dir, "first_message.md")),
  ]);

  const warnings: string[] = [];
  const tagline = rawTagline?.trim() ?? metadata?.match(/<--[^\n]*-->/)?.[0].trim() ?? null;
  if (metadata && !tagline) warnings.push("metadata.md exists but no tagline badge was found");
  if (metadata && !metadataField(metadata, "Name"))
    warnings.push("metadata.md exists but no Name row parsed");
  if (metadata && metadataTags(metadata).length === 0)
    warnings.push("metadata.md exists but the Tags section parsed to nothing");

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
    warnings,
  };
}
