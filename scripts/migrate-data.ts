// Migrate existing SillyTavern data from public/data/ into the SQLite database.
// Run with: nub scripts/migrate-data.ts
//
// Migrates: characters (PNG + embedded books), standalone lorebooks (worlds/*.json),
// personas (settings.json), and user prompt settings (system prompt,
// impersonation prompt, post-history instructions).
// Presets and chats are NOT migrated (out of scope).
//
// Re-runnable: skips existing rows by (userId, name) so it is safe to re-run
// after a partial failure.

import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  user,
  characters,
  lorebooks,
  loreEntries,
  personas,
  userSettings,
} from "@/db/schema";
import {
  parseCharacterCard,
  validateCharacterCard,
  type CharacterBook,
  type CharacterDataV2,
} from "@/lib/st-core/character";
import { DEFAULT_LORE_CONFIG, type LoreEntry as LoreEntryData } from "@/lib/st-core/lorebook";
import { normalizeCardData } from "@/lib/character/normalize";

const DEFAULT_USER_ID = "default-user";
const DATA_ROOT = "public/data";
const AVATAR_DIR = "data/avatars";
const PERSONA_ICON_DIR = "data/personas";

type Counts = {
  found: number;
  inserted: number;
  skipped: number;
  failed: number;
};

type Summary = {
  characters: Counts;
  embeddedLorebooks: number;
  lorebooks: Counts;
  loreEntries: number;
  personas: Counts;
};

const ZERO: Counts = { found: 0, inserted: 0, skipped: 0, failed: 0 };

// ── Helpers ────────────────────────────────────────────────────────────────

async function listPngs(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".png"))
    .map((e) => join(dir, e.name));
}

async function listFilesByExt(dir: string, ext: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(ext.toLowerCase()))
    .map((e) => join(dir, e.name));
}

function lorebookNameExists(userId: string, name: string): boolean {
  const rows = db
    .select({ name: lorebooks.name })
    .from(lorebooks)
    .where(eq(lorebooks.userId, userId))
    .all();
  return rows.some((r) => r.name === name);
}

function characterNameExists(userId: string, name: string): boolean {
  const rows = db
    .select({ name: characters.name })
    .from(characters)
    .where(eq(characters.userId, userId))
    .all();
  return rows.some((r) => r.name === name);
}

function personaNameExists(userId: string, name: string): boolean {
  const rows = db
    .select({ name: personas.name })
    .from(personas)
    .where(eq(personas.userId, userId))
    .all();
  return rows.some((r) => r.name === name);
}

// ── User ──────────────────────────────────────────────────────────────────

function ensureDefaultUser(): void {
  const existing = db
    .select()
    .from(user)
    .where(eq(user.id, DEFAULT_USER_ID))
    .get();
  if (existing) {
    console.log(`  → user already exists: ${DEFAULT_USER_ID}`);
    return;
  }
  const now = new Date();
  db.insert(user)
    .values({
      id: DEFAULT_USER_ID,
      name: "Default User",
      email: "default@st-v2.local",
      createdAt: now,
      updatedAt: now,
    })
    .run();
  console.log(`  → created user: ${DEFAULT_USER_ID}`);
}

// ── Characters + embedded lorebooks ────────────────────────────────────────

function insertLorebookFromBook(
  userId: string,
  name: string,
  book: CharacterBook,
): { id: string; entries: number } | null {
  const id = randomUUID();
  const now = new Date();
  try {
    db.insert(lorebooks)
      .values({
        id,
        userId,
        name,
        config: { ...DEFAULT_LORE_CONFIG },
        createdAt: now,
        updatedAt: now,
      })
      .run();
  } catch (e) {
    console.log(`  ✗ Embedded lorebook "${name}": ${(e as Error).message}`);
    return null;
  }

  const entries = Array.isArray(book.entries) ? book.entries : [];
  let inserted = 0;
  let nextUid = 1;
  for (const entry of entries) {
    const uid = typeof entry.id === "number" ? entry.id : nextUid++;
    if (uid >= nextUid) nextUid = uid + 1;
    try {
      db.insert(loreEntries)
        .values({
          id: randomUUID(),
          lorebookId: id,
          uid,
          data: entry as unknown as LoreEntryData,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      inserted++;
    } catch {
      // (lorebookId, uid) collision — skip
    }
  }

  return { id, entries: inserted };
}

async function migrateCharacters(
  userId: string,
  characterByName: Map<string, string>,
): Promise<{ characters: Counts; embeddedLorebooks: number }> {
  const counts: Counts = { ...ZERO };
  let embeddedCount = 0;

  // Seed the map with whatever already exists
  const existing = db
    .select()
    .from(characters)
    .where(eq(characters.userId, userId))
    .all();
  for (const row of existing) {
    characterByName.set(row.name, row.id);
  }

  const pngs = await listPngs(join(DATA_ROOT, "characters"));
  counts.found = pngs.length;
  await mkdir(AVATAR_DIR, { recursive: true });

  for (const pngPath of pngs) {
    const fileBase = basename(pngPath, ".png");

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await readFile(pngPath));
    } catch (e) {
      console.log(`  ✗ ${fileBase}: failed to read PNG (${(e as Error).message})`);
      counts.failed++;
      continue;
    }

    let raw: unknown;
    try {
      raw = parseCharacterCard(bytes);
    } catch (e) {
      console.log(`  ✗ ${fileBase}: ${(e as Error).message}`);
      counts.failed++;
      continue;
    }

    const normalized = normalizeCardData(raw);
    const validation = validateCharacterCard(normalized);
    if (!validation.ok) {
      const errs = validation.errors
        .map((e) => `${e.field || "(root)"}: ${e.message}`)
        .join("; ");
      console.log(`  ✗ ${fileBase}: validation (${errs})`);
      counts.failed++;
      continue;
    }

    const data = validation.card.data as CharacterDataV2;
    const name = (data.name || fileBase).trim();

    if (characterNameExists(userId, name)) {
      counts.skipped++;
      continue;
    }

    const id = randomUUID();
    const imagePath = join(AVATAR_DIR, `${id}.png`);

    try {
      await copyFile(pngPath, imagePath);
    } catch (e) {
      console.log(`  ✗ ${fileBase}: avatar copy (${(e as Error).message})`);
      counts.failed++;
      continue;
    }

    const now = new Date();
    try {
      db.insert(characters)
        .values({
          id,
          userId,
          name,
          data,
          imagePath,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    } catch (e) {
      console.log(`  ✗ ${fileBase}: insert (${(e as Error).message})`);
      counts.failed++;
      continue;
    }

    characterByName.set(name, id);
    counts.inserted++;
    console.log(`  ✓ ${name}`);

    if (data.character_book) {
      const embeddedName = `${name} [embedded]`;
      if (!lorebookNameExists(userId, embeddedName)) {
        const result = insertLorebookFromBook(userId, embeddedName, data.character_book);
        if (result) embeddedCount++;
      }
    }
  }

  return { characters: counts, embeddedLorebooks: embeddedCount };
}

// ── Standalone lorebooks (worlds/*.json) ───────────────────────────────────

interface WorldEntry {
  uid?: number;
  [k: string]: unknown;
}

interface WorldFile {
  entries?: Record<string, WorldEntry>;
  [k: string]: unknown;
}

function insertLorebookFromWorldFile(
  userId: string,
  name: string,
  world: WorldFile,
): { id: string; entries: number } | null {
  const id = randomUUID();
  const now = new Date();
  try {
    db.insert(lorebooks)
      .values({
        id,
        userId,
        name,
        config: { ...DEFAULT_LORE_CONFIG },
        createdAt: now,
        updatedAt: now,
      })
      .run();
  } catch (e) {
    console.log(`  ✗ Lorebook "${name}": ${(e as Error).message}`);
    return null;
  }

  const entries = world.entries ?? {};
  let inserted = 0;
  let nextUid = 1;
  for (const [, entry] of Object.entries(entries)) {
    const uid = typeof entry.uid === "number" ? entry.uid : nextUid++;
    if (uid >= nextUid) nextUid = uid + 1;
    try {
      db.insert(loreEntries)
        .values({
          id: randomUUID(),
          lorebookId: id,
          uid,
          data: entry as unknown as LoreEntryData,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      inserted++;
    } catch {
      // (lorebookId, uid) collision — skip
    }
  }

  return { id, entries: inserted };
}

async function migrateLorebooks(
  userId: string,
): Promise<{ lorebooks: Counts; loreEntries: number }> {
  const counts: Counts = { ...ZERO };
  let totalEntries = 0;

  const worldDir = join(DATA_ROOT, "worlds");
  if (!existsSync(worldDir)) {
    return { lorebooks: counts, loreEntries: totalEntries };
  }

  const files = await listFilesByExt(worldDir, ".json");
  counts.found = files.length;

  for (const filePath of files) {
    const name = basename(filePath, extname(filePath));
    if (lorebookNameExists(userId, name)) {
      counts.skipped++;
      continue;
    }

    let world: WorldFile;
    try {
      const text = readFileSync(filePath, "utf8");
      world = JSON.parse(text) as WorldFile;
    } catch (e) {
      console.log(`  ✗ ${name}: parse (${(e as Error).message})`);
      counts.failed++;
      continue;
    }

    const result = insertLorebookFromWorldFile(userId, name, world);
    if (result) {
      counts.inserted++;
      totalEntries += result.entries;
      console.log(`  ✓ ${name} (${result.entries} entries)`);
    } else {
      counts.failed++;
    }
  }

  return { lorebooks: counts, loreEntries: totalEntries };
}

// ── Personas (settings.json) ──────────────────────────────────────────────

interface PersonaDescription {
  description?: string;
  position?: number;
  [k: string]: unknown;
}

interface SettingsFile {
  power_user?: {
    personas?: Record<string, string>;
    persona_descriptions?: Record<string, PersonaDescription>;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

async function migratePersonas(userId: string): Promise<Counts> {
  const counts: Counts = { ...ZERO };
  const settingsPath = join(DATA_ROOT, "settings.json");
  if (!existsSync(settingsPath)) return counts;

  await mkdir(PERSONA_ICON_DIR, { recursive: true });

  let settings: SettingsFile;
  try {
    const text = await readFile(settingsPath, "utf8");
    settings = JSON.parse(text) as SettingsFile;
  } catch (e) {
    console.log(`  ✗ settings.json: ${(e as Error).message}`);
    return counts;
  }

  const personasMap = settings.power_user?.personas ?? {};
  const descriptionsMap = settings.power_user?.persona_descriptions ?? {};
  counts.found = Object.keys(personasMap).length;

  for (const [avatarKey, name] of Object.entries(personasMap)) {
    if (personaNameExists(userId, name)) {
      counts.skipped++;
      continue;
    }

    const description = descriptionsMap[avatarKey]?.description ?? "";
    const id = randomUUID();

    let iconPath: string | null = null;
    const userAvatarPath = join(DATA_ROOT, "User Avatars", avatarKey);
    const thumbnailPath = join(DATA_ROOT, "thumbnails", "persona", avatarKey);
    const sourcePath = existsSync(userAvatarPath)
      ? userAvatarPath
      : existsSync(thumbnailPath)
        ? thumbnailPath
        : null;

    if (sourcePath) {
      iconPath = join(PERSONA_ICON_DIR, `${id}.png`);
      try {
        await copyFile(sourcePath, iconPath);
      } catch (e) {
        console.log(`  ✗ ${name}: icon copy (${(e as Error).message})`);
        iconPath = null;
      }
    }

    const now = new Date();
    try {
      db.insert(personas)
        .values({
          id,
          userId,
          name,
          description,
          iconPath,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      counts.inserted++;
      console.log(`  ✓ ${name}${iconPath ? " (with icon)" : " (no icon)"}`);
    } catch (e) {
      console.log(`  ✗ ${name}: ${(e as Error).message}`);
      counts.failed++;
    }
  }

  return counts;
}

// ── User settings (prompts from settings.json) ───────────────────────────

function migrateUserSettings(userId: string): void {
  const settingsPath = join(DATA_ROOT, "settings.json");
  if (!existsSync(settingsPath)) return;

  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
  } catch {
    return;
  }

  const patch: Record<string, string | null> = {};

  // systemPrompt — from power_user.sysprompt.content
  const sysprompt = (settings as any).power_user?.sysprompt;
  if (sysprompt?.content) {
    patch.systemPrompt = String(sysprompt.content);
  }

  // impersonationPrompt — from oai_settings.impersonation_prompt
  const oai = (settings as any).oai_settings;
  if (oai?.impersonation_prompt) {
    patch.impersonationPrompt = String(oai.impersonation_prompt);
  }

  // postHistoryInstructions — from extension_settings.note.default
  const note = (settings as any).extension_settings?.note;
  if (note?.default) {
    patch.postHistoryInstructions = String(note.default);
  }

  const keys = Object.keys(patch);
  if (keys.length === 0) return;

  const now = new Date();
  db.insert(userSettings)
    .values({
      userId,
      ...patch,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { ...patch, updatedAt: now },
    })
    .run();

  console.log(`  → migrated user settings: ${keys.join(", ")}`);
}

// ── Main ─────────────────────────────────────────────────────────────────

function printSummary(s: Summary) {
  const lines: string[] = [];
  const header = (label: string) => lines.push(`\n${label}`);
  const row = (label: string, c: Counts, extra?: string) =>
    lines.push(
      `  ${label.padEnd(28)}  found=${c.found}  inserted=${c.inserted}  skipped=${c.skipped}  failed=${c.failed}${extra ? `  ${extra}` : ""}`,
    );

  header("Migration summary");
  row("Characters", s.characters);
  lines.push(`  ${"Embedded lorebooks".padEnd(28)}  inserted=${s.embeddedLorebooks}`);
  row("Lorebooks (worlds)", s.lorebooks);
  lines.push(`  ${"Lore entries".padEnd(28)}  total=${s.loreEntries}`);
  row("Personas", s.personas);
  lines.push("");
  console.log(lines.join("\n"));
}

async function main() {
  console.log("=== st-v2 data migration ===\n");
  console.log("Source:", DATA_ROOT);
  console.log("DB:", process.env.DATABASE_URL ?? "(DATABASE_URL not set)");
  console.log("");

  console.log("[1/4] Ensuring default user...");
  ensureDefaultUser();
  const userId = DEFAULT_USER_ID;

  const characterByName = new Map<string, string>();

  console.log("\n[2/4] Migrating characters...");
  const charResult = await migrateCharacters(userId, characterByName);
  console.log(
    `  → ${charResult.characters.inserted} inserted, ${charResult.characters.skipped} skipped, ${charResult.characters.failed} failed`,
  );

  console.log("\n[3/4] Migrating standalone lorebooks (worlds/*.json)...");
  const loreResult = await migrateLorebooks(userId);
  console.log(
    `  → ${loreResult.lorebooks.inserted} inserted, ${loreResult.lorebooks.skipped} skipped, ${loreResult.lorebooks.failed} failed, ${loreResult.loreEntries} entries`,
  );

  console.log("\n[4/4] Migrating personas...");
  const personaResult = await migratePersonas(userId);
  console.log(
    `  → ${personaResult.inserted} inserted, ${personaResult.skipped} skipped, ${personaResult.failed} failed`,
  );

  console.log("\n[5/5] Migrating user settings (prompts)...");
  migrateUserSettings(userId);

  printSummary({
    characters: charResult.characters,
    embeddedLorebooks: charResult.embeddedLorebooks,
    lorebooks: loreResult.lorebooks,
    loreEntries: loreResult.loreEntries,
    personas: personaResult,
  });
}

main().catch((e) => {
  console.error("\nFATAL:", e);
  process.exit(1);
});
