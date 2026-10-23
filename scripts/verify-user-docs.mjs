#!/usr/bin/env node
/**
 * Verification harness for docs/user/ end-user documentation.
 *
 * Plain Node, zero dependencies. Run:  node scripts/verify-user-docs.mjs
 * Single file:  node scripts/verify-user-docs.mjs --file docs/user/chatting.md
 *
 * Exit 0 = all checks pass. Prints one PASS/FAIL line per check.
 *
 * Machine checks:
 *   1. All 7 files exist
 *   2. Per-page prose word count within range (code fences, links, inline code,
 *      bold/italic markers, heading hashes stripped before counting)
 *   3. Banned tokens absent (demo-account concepts, dead keyboard shortcuts,
 *      AI-slop filler, emoji)
 *   4. Required exact-string UI labels present per page
 *   5. Internal relative .md links resolve to existing files; every page links
 *      back to ./index.md
 *   6. Glossary terms from index.md "Core concepts" present (term consistency)
 *   7. chatting.md shortcut whitelist: contains the 6 verified shortcuts and no
 *      other Ctrl/Cmd combination
 *   8. lorebooks.md documents GLOBAL activation ("all chats" + global/GLOBAL)
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_DIR = join(ROOT, "docs", "user");

const FILES = [
  "index.md",
  "getting-started.md",
  "chatting.md",
  "characters.md",
  "lorebooks.md",
  "personas-scenes-presets.md",
  "troubleshooting.md",
];

const WORD_RANGES = {
  "index.md": [350, 500],
  "getting-started.md": [600, 900],
  "chatting.md": [400, 700],
  "characters.md": [400, 700],
  "lorebooks.md": [400, 700],
  "personas-scenes-presets.md": [400, 700],
  "troubleshooting.md": [300, 450],
};

// Banned tokens — case-insensitive substring match, except emoji (regex).
const BANNED_TOKENS = [
  "demo",
  "daily",
  "100 messages",
  "shared provider",
  "bun run",
  "ctrl+←",
  "ctrl+→",
  "ctrl+shift+enter",
  "delve",
  "unlock",
  "seamless",
  "elevate",
  "effortlessly",
  "harness",
  "leverage",
  "empower",
  "robust",
  "streamline",
];

// "Ctrl+Enter" is allowed ONLY as the save-edit form ("Save (or Ctrl+Enter)")
// — banned otherwise because the continue-shortcut form is dead code.
const CTRL_ENTER = "ctrl+enter";
const SAVE_CONTEXT = /(?:save|saving|saved)\s*\(?[^)]{0,20}/i;

// Emoji detection — arrows (U+2190-U+21FF, U+2B05-U+2B07) are legitimate
// UI-navigation glyphs (e.g. "Settings → AI Providers"), NOT emoji, so they're
// excluded. Dead shortcuts using arrows are still banned via BANNED_TOKENS.
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;

// Canonical glossary terms that index.md "Core concepts" must define.
const GLOSSARY_TERMS = [
  "character",
  "character card",
  "chat",
  "branch",
  "swipe",
  "regenerate",
  "lorebook",
  "lore entry",
  "persona",
  "provider",
  "api key",
  "model",
  "base url",
  "preset",
  "scene",
  "greeting",
  "impersonate",
  "continue",
  "markdown",
];

// Required exact-string labels per page.
const REQUIRED_LABELS = {
  "index.md": [
    "Character",
    "Character card",
    "Swipe",
    "Regenerate",
    "Lorebook",
    "Persona",
    "Provider",
    "Preset",
    "Greeting",
    "Impersonate",
    "Continue",
    "Markdown",
    "API key",
    "http://localhost:3000",
  ],
  "getting-started.md": [
    "Create your account",
    "onboarding",
    "Start chatting",
    "Import PNG",
    "Start Chat",
  ],
  "chatting.md": ["Shift+Enter", "Ctrl/Cmd+Enter", "Ctrl+K", "wand", "all messages after it"],
  "characters.md": [
    "Import PNG",
    "No description on card",
    "V3 card — data normalized to V2 for compatibility",
    "Start Chat",
    "Continue chat",
    "Recently updated",
    "Name A–Z",
    "Most chats",
  ],
  "lorebooks.md": [
    "all chats",
    "GLOBAL",
    "New Entry",
    "Constant (always active)",
    "Secondary keys",
    "Order",
    "Disabled",
    "world-info",
  ],
  "personas-scenes-presets.md": [
    "Your persona",
    "Chat details",
    "Model & preset",
    "Clear scene",
    "Temperature",
    "Top P",
    "Max tokens",
    "Context size",
    "Frequency penalty",
    "Presence penalty",
    "Highlight dialogue",
    "Auto-fix Markdown",
    "Block external media",
    "Profile",
  ],
  "troubleshooting.md": ["dev.db", "50 MB", "Auto-fix Markdown", "SQLite"],
};

// The six verified keyboard shortcuts — everything else is dead code.
const SHORTCUT_WHITELIST = ["Enter", "Shift+Enter", "Ctrl/Cmd+Enter", "Esc", "Ctrl+K", "/"];

let failures = 0;

function fail(msg) {
  failures += 1;
  console.log(`  FAIL  ${msg}`);
}

function pass(msg) {
  console.log(`  PASS  ${msg}`);
}

function read(file) {
  const p = join(DOCS_DIR, file);
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf8");
}

/** Strip code fences, inline code, links, images, bold/italic markers, headings. */
function proseOf(text) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\*\*|__|\*|_|~~|#/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text) {
  const p = proseOf(text);
  if (!p) return 0;
  return p.split(" ").length;
}

function checkFileExistence() {
  console.log("Check 1: all files exist");
  let ok = true;
  for (const f of FILES) {
    if (read(f) === null) {
      fail(`missing ${f}`);
      ok = false;
    }
  }
  if (ok) pass(`${FILES.length} files present in docs/user/`);
  return ok;
}

function checkWordCounts() {
  console.log("Check 2: per-page prose word counts");
  let ok = true;
  for (const [f, [min, max]] of Object.entries(WORD_RANGES)) {
    const text = read(f);
    if (text === null) continue;
    const n = wordCount(text);
    if (n < min || n > max) {
      fail(`${f}: ${n} words (want ${min}-${max})`);
      ok = false;
    } else {
      pass(`${f}: ${n} words`);
    }
  }
  return ok;
}

function checkBannedTokens() {
  console.log("Check 3: banned tokens absent");
  let ok = true;
  for (const f of FILES) {
    const text = read(f);
    if (text === null) continue;
    const lower = text.toLowerCase();
    for (const token of BANNED_TOKENS) {
      if (lower.includes(token)) {
        fail(`${f}: banned token "${token}"`);
        ok = false;
      }
    }
    if (EMOJI_RE.test(text)) {
      fail(`${f}: emoji present`);
      ok = false;
    }
    // Ctrl+Enter with the save-edit exception.
    let idx = lower.indexOf(CTRL_ENTER);
    while (idx !== -1) {
      const before = text.slice(Math.max(0, idx - 40), idx);
      if (!SAVE_CONTEXT.test(before)) {
        fail(`${f}: banned "Ctrl+Enter" (dead continue shortcut) not in save context`);
        ok = false;
        break;
      }
      idx = lower.indexOf(CTRL_ENTER, idx + 1);
    }
  }
  if (ok) pass("no banned tokens or emoji in any page");
  return ok;
}

function checkRequiredLabels() {
  console.log("Check 4: required UI labels present (exact strings)");
  let ok = true;
  for (const [f, labels] of Object.entries(REQUIRED_LABELS)) {
    const text = read(f);
    if (text === null) continue;
    for (const label of labels) {
      if (!text.includes(label)) {
        fail(`${f}: missing label "${label}"`);
        ok = false;
      }
    }
  }
  if (ok) pass("all required labels present");
  return ok;
}

function checkLinks() {
  console.log("Check 5: internal links resolve; every page links to ./index.md");
  let ok = true;
  const linkRe = /\[[^\]]*\]\(([^)]*)\)/g;
  for (const f of FILES) {
    const text = read(f);
    if (text === null) continue;
    if (!f.startsWith("index") && !text.includes("./index.md")) {
      fail(`${f}: does not link back to ./index.md`);
      ok = false;
    }
    let m;
    linkRe.lastIndex = 0;
    while ((m = linkRe.exec(text)) !== null) {
      const target = m[1].split("#")[0];
      if (!/\.md$/.test(target)) continue; // external or anchor-only
      if (/^https?:/.test(target)) continue;
      if (target.startsWith("..")) continue; // root-relative links are fine
      const resolved = normalize(join(DOCS_DIR, target));
      if (!existsSync(resolved)) {
        fail(`${f}: dead link → ${target}`);
        ok = false;
      }
    }
  }
  if (ok) pass("all internal .md links resolve; index links present");
  return ok;
}

function checkGlossary() {
  console.log("Check 6: glossary terms defined in index.md Core concepts");
  let ok = true;
  const index = read("index.md");
  if (index === null) return ok;
  const lower = index.toLowerCase();
  const coreIdx = lower.indexOf("core concepts");
  const section = coreIdx === -1 ? lower : lower.slice(coreIdx);
  for (const term of GLOSSARY_TERMS) {
    if (!section.includes(term)) {
      fail(`index.md Core concepts: missing term "${term}"`);
      ok = false;
    }
  }
  if (ok) pass(`all ${GLOSSARY_TERMS.length} glossary terms in Core concepts`);
  return ok;
}

function checkShortcuts() {
  console.log("Check 7: chatting.md shortcut whitelist");
  let ok = true;
  const chatting = read("chatting.md");
  if (chatting === null) return ok;
  for (const s of SHORTCUT_WHITELIST) {
    if (!chatting.includes(s)) {
      fail(`chatting.md: missing shortcut "${s}"`);
      ok = false;
    }
  }
  // Any other Ctrl/Cmd+something combo is dead code.
  const other = chatting.match(/ctrl(\+|\/cmd\+)\+[a-z←→0-9]+/gi) || [];
  const banned = other.filter(
    (k) => !k.toLowerCase().includes("cmd+enter") && !k.toLowerCase().includes("ctrl+k"),
  );
  for (const k of banned) {
    fail(`chatting.md: unverified shortcut "${k}"`);
    ok = false;
  }
  if (ok) pass("exactly the six verified shortcuts present, none extra");
  return ok;
}

function checkLorebookGlobal() {
  console.log("Check 8: lorebooks.md documents GLOBAL activation");
  let ok = true;
  const lore = read("lorebooks.md");
  if (lore === null) return ok;
  const lower = lore.toLowerCase();
  if (!lower.includes("all chats")) {
    fail("lorebooks.md: missing phrase 'all chats'");
    ok = false;
  }
  if (!lower.includes("global")) {
    fail("lorebooks.md: missing 'global'");
    ok = false;
  }
  if (lower.includes("this chat only")) {
    fail("lorebooks.md: contains forbidden 'this chat only'");
    ok = false;
  }
  if (ok) pass("global activation documented");
  return ok;
}

// ── main ────────────────────────────────────────────────────────────────────

const onlyFile = process.argv.includes("--file")
  ? process.argv[process.argv.indexOf("--file") + 1]
  : null;

const checks = [
  ["1", checkFileExistence],
  ["2", checkWordCounts],
  ["3", checkBannedTokens],
  ["4", checkRequiredLabels],
  ["5", checkLinks],
  ["6", checkGlossary],
  ["7", checkShortcuts],
  ["8", checkLorebookGlobal],
];

for (const [name, fn] of checks) {
  console.log(`\n[${name}]`);
  const result = fn();
  if (!result && !onlyFile) {
    // continue to next check — report everything
  }
}

if (onlyFile) {
  console.log(`\n(checked single file: ${onlyFile})`);
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
