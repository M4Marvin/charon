import { stat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { CardPackage, CheckResult, Issue } from "./types.js";

const CSS_LIMIT = 15_500;
const CSS_WARN = 14_000;
const GREETING_MIN = 400;
const GREETING_MAX = 5_000;

function styleBlocks(page: string): { css: string; wrapped: boolean }[] {
  const blocks: { css: string; wrapped: boolean }[] = [];
  for (const match of page.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    const before = page.slice(Math.max(0, (match.index ?? 0) - 400), match.index ?? 0);
    blocks.push({ css: match[1], wrapped: /<svg[^>]*>\s*$/i.test(before) });
  }
  return blocks;
}

function badge(tagline: string | null, glyph: string): number | null {
  if (!tagline) return null;
  const match = tagline.match(new RegExp(`${glyph}\\s*(\\d+)`));
  return match ? Number(match[1]) : null;
}

async function imageSize(path: string): Promise<{ width: number; height: number } | null> {
  const exists = await stat(path).catch(() => null);
  if (!exists) return null;
  const meta = await sharp(path).metadata();
  return meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
}

export async function checkCard(pkg: CardPackage): Promise<CheckResult> {
  const issues: Issue[] = [];
  const add = (level: Issue["level"], code: string, message: string) =>
    issues.push({ level, code, message });

  for (const warning of pkg.warnings) add("warn", "discovery", warning);

  if (!pkg.page) add("error", "page-missing", "no description.html (the chub page)");
  if (!pkg.personality) add("warn", "bible-missing", "no personality.md (chub Description)");

  let cssBytes = 0;
  if (pkg.page) {
    const blocks = styleBlocks(pkg.page);
    if (!blocks.length) add("warn", "no-skin", "page has no <style> block");
    for (const block of blocks) {
      if (!block.wrapped)
        add("error", "style-unwrapped", "a <style> block is not inside <svg> (chub strips it)");
      cssBytes += block.css.length;
    }
    if (cssBytes > CSS_LIMIT)
      add("error", "css-too-big", `CSS ${cssBytes} B over the ${CSS_LIMIT} B chub limit`);
    else if (cssBytes > CSS_WARN)
      add("warn", "css-large", `CSS ${cssBytes} B is close to the ${CSS_LIMIT} B limit`);
  }

  const taglineGreetings = badge(pkg.tagline, "💬");
  const taglineImages = badge(pkg.tagline, "🖼");
  if (!pkg.tagline) add("warn", "tagline-missing", "no tagline.txt");
  else {
    if (taglineGreetings === null) add("warn", "badge-greetings", "tagline has no 💬 count");
    else if (taglineGreetings !== pkg.greetings.length)
      add(
        "error",
        "badge-mismatch",
        `tagline says ${taglineGreetings} greetings, card has ${pkg.greetings.length}`,
      );
    if (taglineImages === null) add("warn", "badge-images", "tagline has no 🖼 count");
    else if (taglineImages !== pkg.images.length)
      add(
        "error",
        "image-count-mismatch",
        `tagline says ${taglineImages} images, card references ${pkg.images.length}`,
      );
  }

  if (!pkg.greetings.length) add("error", "no-greetings", "no greeting files found");

  const seen = new Map<string, string>();
  for (const greeting of pkg.greetings) {
    for (const url of greeting.images) {
      const first = seen.get(url);
      if (first) add("warn", "duplicate-image", `${url} used by ${first} and ${greeting.id}`);
      else seen.set(url, greeting.id);
    }
  }

  for (const greeting of pkg.greetings) {
    const where = greeting.id;
    if (!greeting.text.length) {
      add("error", "greeting-empty", `${where}: empty`);
      continue;
    }
    if (greeting.text.includes("**"))
      add(
        "error",
        "speaker-labels",
        `${where}: bold text (speaker labels teach the model to label)`,
      );
    if (!/\*[^*]+\*/.test(greeting.text))
      add("warn", "no-narration", `${where}: no italic narration`);
    if (greeting.text.length < GREETING_MIN || greeting.text.length > GREETING_MAX)
      add(
        "warn",
        "greeting-length",
        `${where}: ${greeting.text.length} chars (soft range ${GREETING_MIN}-${GREETING_MAX})`,
      );
    if (!greeting.images.length) add("error", "greeting-no-image", `${where}: no image`);
    else if (!greeting.text.trimEnd().endsWith(")"))
      add("error", "image-not-last", `${where}: image is not the last thing in the greeting`);
  }

  if (pkg.personality) {
    if (/Begin paragraphs with/i.test(pkg.personality))
      add("error", "label-instruction", "personality still tells the model to label speakers");
    if (!/narrator/i.test(pkg.personality))
      add("warn", "no-narrator-rule", "personality has no narrator rule");
  }

  for (const file of ["avatar.png", "card.png"]) {
    const size = await imageSize(join(pkg.dir, file));
    if (!size) continue;
    if (size.height <= size.width)
      add("warn", "aspect", `${file} is ${size.width}x${size.height}, chub wants portrait (2:3)`);
  }

  return {
    ok: !issues.some((issue) => issue.level === "error"),
    issues,
    stats: {
      greetings: pkg.greetings.length,
      images: pkg.images.length,
      taglineGreetings,
      taglineImages,
      cssBytes,
    },
  };
}

/** Reachability check for every image URL; separate because it needs the network. */
export async function checkImageUrls(pkg: CardPackage, timeoutMs = 8_000): Promise<Issue[]> {
  const issues: Issue[] = [];
  await Promise.all(
    pkg.images.map(async (url) => {
      try {
        const response = await fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok)
          issues.push({
            level: "error",
            code: "url-dead",
            message: `${url} -> ${response.status}`,
          });
      } catch (error) {
        issues.push({
          level: "error",
          code: "url-dead",
          message: `${url} -> ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),
  );
  return issues;
}
