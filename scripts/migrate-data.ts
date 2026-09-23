// Migrate existing SillyTavern data from data/import/ into the SQLite database and private uploads.
// Run with: pnpm run prepare:migration && pnpm run migrate
//
// Migrates: characters (PNG + embedded books), standalone lorebooks (worlds/*.json),
// personas (settings.json), and user prompt settings (system prompt,
// impersonation prompt, post-history instructions).
// Presets and chats are NOT migrated (out of scope).
//
// Re-runnable: skips existing rows by name so it is safe to re-run after a
// partial failure.

import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { readdir, rm } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

import { db } from "@/db";
import { user, characters, lorebooks, loreEntries, personas } from "@/db/schema";
import { derivedColumns } from "@/db/repositories/characters";
import { validateUploadedImage } from "@/server/image-limits";
import { readMigrationFile, resolveMigrationDirectory, resolveMigrationFile } from "./migration-io";
import {
  diskPathFromStored,
  ensureUploadsDirs,
  storedPathFromDiskComponents,
  writePrivateFileAtomic,
} from "@/server/uploads";
import { upsertUserSettings, type UserSettingsPatch } from "@/db/repositories/userSettings";
import {
  parseCharacterCard,
  validateCharacterCard,
  validateCharacterCardV3,
  type CharacterBook,
  type CharacterDataV2,
} from "@/lib/st-core/character";
import { DEFAULT_LORE_CONFIG, type LoreEntry as LoreEntryData } from "@/lib/st-core/lorebook";
import { parseWorldFile } from "@/lib/lorebook/world-file";
import { normalizeCardData, normalizeV3ToV2 } from "@/lib/character/normalize";

const DATA_ROOT = "data/import";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWithin(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === "" ||
    (pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot))
  );
}

function isSafeAvatarKey(key: string): boolean {
  return (
    key.length > 0 &&
    key !== "." &&
    key !== ".." &&
    !key.includes("/") &&
    !key.includes("\\") &&
    !key.includes("\0")
  );
}

function resolveMigrationSource(rootDir: string, key: string): string | null {
  if (!isSafeAvatarKey(key)) return null;

  try {
    const dataRoot = realpathSync(DATA_ROOT);
    const root = realpathSync(rootDir);
    if (!isWithin(dataRoot, root)) return null;

    const candidate = resolve(root, key);
    if (!isWithin(root, candidate)) return null;
    const realCandidate = realpathSync(candidate);
    return isWithin(root, realCandidate) ? realCandidate : null;
  } catch {
    return null;
  }
}

type ParsedSettings = {
  personas: Record<string, string>;
  descriptions: Record<string, string>;
  systemPrompt?: string;
  impersonationPrompt?: string;
  postHistoryInstructions?: string;
};

function parseSettingsFile(value: unknown): ParsedSettings | null {
  if (!isRecord(value)) return null;

  const powerUser = value.power_user;
  if (powerUser !== undefined && !isRecord(powerUser)) return null;

  const rawPersonas = powerUser?.personas;
  if (rawPersonas !== undefined && !isRecord(rawPersonas)) return null;
  const personas: Record<string, string> = {};
  for (const [key, name] of Object.entries(rawPersonas ?? {})) {
    if (typeof name !== "string") return null;
    personas[key] = name;
  }

  const rawDescriptions = powerUser?.persona_descriptions;
  if (rawDescriptions !== undefined && !isRecord(rawDescriptions)) return null;
  const descriptions: Record<string, string> = {};
  for (const [key, raw] of Object.entries(rawDescriptions ?? {})) {
    if (!isRecord(raw)) return null;
    if (raw.description !== undefined && typeof raw.description !== "string") return null;
    descriptions[key] = raw.description ?? "";
  }

  const sysprompt = powerUser?.sysprompt;
  if (sysprompt !== undefined && !isRecord(sysprompt)) return null;
  if (sysprompt?.content !== undefined && typeof sysprompt.content !== "string") return null;

  const oai = value.oai_settings;
  if (oai !== undefined && !isRecord(oai)) return null;
  if (oai?.impersonation_prompt !== undefined && typeof oai.impersonation_prompt !== "string") {
    return null;
  }

  const extensions = value.extension_settings;
  if (extensions !== undefined && !isRecord(extensions)) return null;
  const note = extensions?.note;
  if (note !== undefined && !isRecord(note)) return null;
  if (note?.default !== undefined && typeof note.default !== "string") return null;

  return {
    personas,
    descriptions,
    systemPrompt: sysprompt?.content,
    impersonationPrompt: oai?.impersonation_prompt,
    postHistoryInstructions: note?.default,
  };
}

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
  const sourceDir = resolveMigrationDirectory(DATA_ROOT, dir);
  if (!sourceDir) return [];
  const entries = await readdir(sourceDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".png"))
    .map((e) => join(sourceDir, e.name));
}

async function listFilesByExt(dir: string, ext: string): Promise<string[]> {
  const sourceDir = resolveMigrationDirectory(DATA_ROOT, dir);
  if (!sourceDir) return [];
  const entries = await readdir(sourceDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(ext.toLowerCase()))
    .map((e) => join(sourceDir, e.name));
}

function lorebookNameExists(name: string): boolean {
  const rows = db.select({ name: lorebooks.name }).from(lorebooks).all();
  return rows.some((r) => r.name === name);
}

function characterNameExists(name: string): boolean {
  const rows = db.select({ name: characters.name }).from(characters).all();
  return rows.some((r) => r.name === name);
}

function personaNameExists(name: string): boolean {
  const rows = db.select({ name: personas.name }).from(personas).all();
  return rows.some((r) => r.name === name);
}

// ── Characters + embedded lorebooks ────────────────────────────────────────

function insertLorebookFromBook(
  name: string,
  book: CharacterBook,
): { id: string; entries: number } | null {
  const id = randomUUID();
  const now = new Date();
  try {
    db.insert(lorebooks)
      .values({
        id,
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
  characterByName: Map<string, string>,
): Promise<{ characters: Counts; embeddedLorebooks: number }> {
  const counts: Counts = { ...ZERO };
  let embeddedCount = 0;

  // Seed the map with whatever already exists
  const existing = db.select().from(characters).all();
  for (const row of existing) {
    characterByName.set(row.name, row.id);
  }

  const pngs = await listPngs(join(DATA_ROOT, "characters"));
  counts.found = pngs.length;

  for (const pngPath of pngs) {
    const fileBase = basename(pngPath, ".png");

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await readMigrationFile(pngPath));
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

    // V3 cards (parsed via the `ccv3` tEXt chunk if present) are projected
    // to a V2-shaped object with extras stashed in `data.extensions._v3`
    // before the V2 strict arktype gate. V2 cards pass through normalize
    // unchanged.
    const detectedSpec =
      typeof (raw as { spec?: unknown }).spec === "string"
        ? (raw as { spec: string }).spec
        : "chara_card_v2";
    const isV3 = detectedSpec === "chara_card_v3";
    const projected = isV3 ? normalizeV3ToV2(raw) : raw;
    const normalized = normalizeCardData(projected);
    const validation = isV3
      ? validateCharacterCardV3(normalized)
      : validateCharacterCard(normalized);
    if (!validation.ok) {
      const errs = validation.errors.map((e) => `${e.field || "(root)"}: ${e.message}`).join("; ");
      console.log(`  ✗ ${fileBase}: validation (${errs})`);
      counts.failed++;
      continue;
    }

    try {
      await validateUploadedImage(bytes);
    } catch (e) {
      console.log(`  ✗ ${fileBase}: image validation (${(e as Error).message})`);
      counts.failed++;
      continue;
    }

    const data = validation.card.data as CharacterDataV2;
    const spec: "chara_card_v2" | "chara_card_v3" = isV3 ? "chara_card_v3" : "chara_card_v2";
    const specVersion = isV3 ? "3.0" : "2.0";

    const name = (data.name || fileBase).trim();

    if (characterNameExists(name)) {
      counts.skipped++;
      continue;
    }

    const id = randomUUID();
    const filename = `${id}.png`;
    const avatarPath = storedPathFromDiskComponents("avatars", filename);
    const writePath = diskPathFromStored(avatarPath);

    try {
      await writePrivateFileAtomic(writePath, bytes);
    } catch (e) {
      await rm(writePath, { force: true }).catch(() => {});
      console.log(`  ✗ ${fileBase}: avatar copy (${(e as Error).message})`);
      counts.failed++;
      continue;
    }

    const now = new Date();
    try {
      db.insert(characters)
        .values({
          id,
          name,
          data,
          imagePath: avatarPath,
          spec,
          specVersion,
          ...derivedColumns(data),
          createdAt: now,
          updatedAt: now,
        })
        .run();
    } catch (e) {
      await rm(writePath, { force: true }).catch(() => {});
      console.log(`  ✗ ${fileBase}: insert (${(e as Error).message})`);
      counts.failed++;
      continue;
    }

    characterByName.set(name, id);
    counts.inserted++;
    console.log(`  ✓ ${name}${isV3 ? " (v3)" : ""}`);

    if (data.character_book) {
      const embeddedName = `${name} [embedded]`;
      if (!lorebookNameExists(embeddedName)) {
        const result = insertLorebookFromBook(embeddedName, data.character_book);
        if (result) embeddedCount++;
      }
    }
  }

  return { characters: counts, embeddedLorebooks: embeddedCount };
}

// ── Standalone lorebooks (worlds/*.json) ───────────────────────────────────

function insertLorebookFromWorldFile(
  name: string,
  json: string,
): { id: string; entries: number; skipped: number } | null {
  let parsed: ReturnType<typeof parseWorldFile>;
  try {
    parsed = parseWorldFile(json);
  } catch (e) {
    console.log(`  ✗ Lorebook "${name}": ${(e as Error).message}`);
    return null;
  }

  const id = randomUUID();
  const now = new Date();
  try {
    db.transaction((tx) => {
      tx.insert(lorebooks)
        .values({
          id,
          name,
          description: parsed.description,
          config: parsed.config,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      for (const entry of parsed.entries) {
        tx.insert(loreEntries)
          .values({
            id: randomUUID(),
            lorebookId: id,
            uid: entry.uid,
            data: entry,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    });
  } catch (e) {
    console.log(`  ✗ Lorebook "${name}": ${(e as Error).message}`);
    return null;
  }

  return { id, entries: parsed.entries.length, skipped: parsed.entriesSkipped };
}

async function migrateLorebooks(): Promise<{ lorebooks: Counts; loreEntries: number }> {
  const counts: Counts = { ...ZERO };
  let totalEntries = 0;

  const worldDir = join(DATA_ROOT, "worlds");
  const files = await listFilesByExt(worldDir, ".json");
  counts.found = files.length;

  for (const filePath of files) {
    const name = basename(filePath, extname(filePath));
    if (lorebookNameExists(name)) {
      counts.skipped++;
      continue;
    }

    let json: string;
    try {
      json = (await readMigrationFile(filePath)).toString("utf8");
    } catch (e) {
      console.log(`  ✗ ${name}: read (${(e as Error).message})`);
      counts.failed++;
      continue;
    }

    try {
      const result = insertLorebookFromWorldFile(name, json);
      if (result) {
        counts.inserted++;
        totalEntries += result.entries;
        console.log(
          `  ✓ ${name} (${result.entries} entries${result.skipped ? `, ${result.skipped} skipped` : ""})`,
        );
      } else {
        counts.failed++;
      }
    } catch (e) {
      console.log(`  ✗ ${name}: migration (${(e as Error).message})`);
      counts.failed++;
    }
  }

  return { lorebooks: counts, loreEntries: totalEntries };
}

// ── Personas (settings.json) ──────────────────────────────────────────────

async function migratePersonas(): Promise<Counts> {
  const counts: Counts = { ...ZERO };
  const settingsPath = resolveMigrationFile(DATA_ROOT, join(DATA_ROOT, "settings.json"));
  if (!settingsPath) return counts;

  let settings: ParsedSettings;
  try {
    const text = (await readMigrationFile(settingsPath)).toString("utf8");
    const parsed = parseSettingsFile(JSON.parse(text));
    if (!parsed) {
      console.log("  ✗ settings.json: expected a settings object");
      return counts;
    }
    settings = parsed;
  } catch (e) {
    console.log(`  ✗ settings.json: ${(e as Error).message}`);
    return counts;
  }

  const personasMap = settings.personas;
  const descriptionsMap = settings.descriptions;
  counts.found = Object.keys(personasMap).length;

  for (const [avatarKey, name] of Object.entries(personasMap)) {
    if (personaNameExists(name)) {
      counts.skipped++;
      continue;
    }

    if (!isSafeAvatarKey(avatarKey)) {
      console.log(`  ✗ ${name}: unsafe avatar key`);
      counts.failed++;
      continue;
    }

    const description = descriptionsMap[avatarKey] ?? "";
    const id = randomUUID();

    let iconPath: string | null = null;
    let iconWritePath: string | null = null;
    const sourcePath =
      resolveMigrationSource(join(DATA_ROOT, "User Avatars"), avatarKey) ??
      resolveMigrationSource(join(DATA_ROOT, "thumbnails", "persona"), avatarKey);

    if (sourcePath) {
      const iconFilename = `${id}.png`;
      iconPath = storedPathFromDiskComponents("personas", iconFilename);
      iconWritePath = diskPathFromStored(iconPath);
      try {
        const iconBytes = await readMigrationFile(sourcePath);
        await validateUploadedImage(iconBytes);
        await writePrivateFileAtomic(iconWritePath, iconBytes);
      } catch (e) {
        if (iconWritePath) await rm(iconWritePath, { force: true }).catch(() => {});
        console.log(`  ✗ ${name}: icon copy (${(e as Error).message})`);
        iconPath = null;
      }
    }

    const now = new Date();
    try {
      db.insert(personas)
        .values({
          id,
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
      if (iconWritePath) await rm(iconWritePath, { force: true }).catch(() => {});
      console.log(`  ✗ ${name}: ${(e as Error).message}`);
      counts.failed++;
    }
  }

  return counts;
}

// ── User settings (prompts from settings.json) ───────────────────────────

async function migrateUserSettings(accountId: string): Promise<void> {
  const settingsPath = resolveMigrationFile(DATA_ROOT, join(DATA_ROOT, "settings.json"));
  if (!settingsPath) return;

  let settings: ParsedSettings;
  try {
    const text = (await readMigrationFile(settingsPath)).toString("utf8");
    const parsed = parseSettingsFile(JSON.parse(text));
    if (!parsed) return;
    settings = parsed;
  } catch {
    return;
  }

  const patch: UserSettingsPatch = {};
  if (settings.systemPrompt !== undefined) patch.systemPrompt = settings.systemPrompt;
  if (settings.impersonationPrompt !== undefined) {
    patch.impersonationPrompt = settings.impersonationPrompt;
  }
  if (settings.postHistoryInstructions !== undefined) {
    patch.postHistoryInstructions = settings.postHistoryInstructions;
  }

  const keys = Object.keys(patch);
  if (keys.length === 0) return;

  try {
    upsertUserSettings(accountId, patch);
    console.log(`  → migrated user settings: ${keys.join(", ")}`);
  } catch (error) {
    console.log(`  ✗ user settings: ${(error as Error).message}`);
  }
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
  console.log("=== charon data migration ===\n");
  console.log("Source:", DATA_ROOT);
  console.log("DB:", process.env.DATABASE_URL ?? "(DATABASE_URL not set)");
  console.log("");

  console.log("[1/5] Resolving account...");
  const account = db.select({ id: user.id }).from(user).limit(1).get();
  if (!account) {
    console.error(
      "No account found — open the app and complete the first-run setup before importing SillyTavern data.",
    );
    process.exit(1);
  }
  console.log(`  → using account: ${account.id}`);

  const characterByName = new Map<string, string>();

  await ensureUploadsDirs();

  console.log("\n[2/5] Migrating characters...");
  const charResult = await migrateCharacters(characterByName);
  console.log(
    `  → ${charResult.characters.inserted} inserted, ${charResult.characters.skipped} skipped, ${charResult.characters.failed} failed`,
  );

  console.log("\n[3/5] Migrating standalone lorebooks (worlds/*.json)...");
  const loreResult = await migrateLorebooks();
  console.log(
    `  → ${loreResult.lorebooks.inserted} inserted, ${loreResult.lorebooks.skipped} skipped, ${loreResult.lorebooks.failed} failed, ${loreResult.loreEntries} entries`,
  );

  console.log("\n[4/5] Migrating personas...");
  const personaResult = await migratePersonas();
  console.log(
    `  → ${personaResult.inserted} inserted, ${personaResult.skipped} skipped, ${personaResult.failed} failed`,
  );

  console.log("\n[5/5] Migrating user settings (prompts)...");
  await migrateUserSettings(account.id);

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
