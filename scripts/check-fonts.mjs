#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/fonts.css", import.meta.url), "utf8");
const urls = [...css.matchAll(/url\((\/fonts\/[^)]+)\)/g)].map((match) => match[1]);
const missing = urls.filter((url) => !existsSync(new URL(`../static${url}`, import.meta.url)));

if (urls.length === 0) {
  console.error("check-fonts: no @font-face URLs found in src/fonts.css");
  process.exit(1);
}

if (missing.length > 0) {
  console.error(`check-fonts: ${missing.length} missing font file(s):`);
  for (const url of missing) console.error(`  - static${url}`);
  process.exit(1);
}

console.log(`check-fonts: ${urls.length} declared font files present`);
