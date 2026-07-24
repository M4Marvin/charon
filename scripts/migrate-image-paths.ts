// Migrate uploaded images from public/data/ to data/uploads/
// Changes the backend storage location and DB paths to match.
// Run with: pnpm migrate:image-paths
//
// Idempotent — safe to re-run. Skips already-moved files and already-updated rows.

import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { cp, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq, like } from "drizzle-orm";

import { db } from "@/db";
import { characters, backgrounds, personas } from "@/db/schema";
import {
  ensureUploadsDirs,
  diskPathFromStored,
  storedPathFromDiskComponents,
  UPLOADS_SUBDIRS,
  type UploadSubdir,
} from "@/server/uploads";

const SOURCE_BASE = "public/data";

type Counts = { found: number; moved: number; skipped: number };

async function migrateSubdir(subdir: UploadSubdir): Promise<Counts> {
  const counts: Counts = { found: 0, moved: 0, skipped: 0 };
  const sourceDir = join(SOURCE_BASE, UPLOADS_SUBDIRS[subdir]);
  if (!existsSync(sourceDir)) return counts;

  const entries = await readdir(sourceDir, { withFileTypes: true });
  const images = entries.filter((e) => e.isFile() && /\.(png|jpe?g|webp)$/i.test(e.name));
  counts.found = images.length;

  for (const img of images) {
    const src = join(sourceDir, img.name);
    const stored = storedPathFromDiskComponents(subdir, img.name);
    const dst = diskPathFromStored(stored);

    if (existsSync(dst)) {
      counts.skipped++;
      continue;
    }

    await cp(src, dst);
    counts.moved++;
  }

  return counts;
}

function updateDbPaths(): void {
  const chars = db
    .select({ id: characters.id, p: characters.imagePath })
    .from(characters)
    .where(like(characters.imagePath, "data/avatars/%"))
    .all();
  for (const c of chars) {
    if (c.p) {
      db.update(characters)
        .set({ imagePath: c.p.replace("data/avatars/", "uploads/avatars/") })
        .where(eq(characters.id, c.id))
        .run();
    }
  }

  const bgs = db
    .select({ id: backgrounds.id, p: backgrounds.path })
    .from(backgrounds)
    .where(like(backgrounds.path, "data/backgrounds/%"))
    .all();
  for (const b of bgs) {
    if (b.p) {
      db.update(backgrounds)
        .set({ path: b.p.replace("data/backgrounds/", "uploads/backgrounds/") })
        .where(eq(backgrounds.id, b.id))
        .run();
    }
  }

  const pers = db
    .select({ id: personas.id, p: personas.iconPath })
    .from(personas)
    .where(like(personas.iconPath, "data/personas/%"))
    .all();
  for (const p of pers) {
    if (p.p) {
      db.update(personas)
        .set({ iconPath: p.p.replace("data/personas/", "uploads/personas/") })
        .where(eq(personas.id, p.id))
        .run();
    }
  }
}

function isReferenced(path: string): boolean {
  const likePattern = `data/${path}%`;
  return (
    db
      .select({ id: characters.id })
      .from(characters)
      .where(like(characters.imagePath, likePattern))
      .limit(1)
      .get() !== undefined ||
    db
      .select({ id: backgrounds.id })
      .from(backgrounds)
      .where(like(backgrounds.path, likePattern))
      .limit(1)
      .get() !== undefined ||
    db
      .select({ id: personas.id })
      .from(personas)
      .where(like(personas.iconPath, likePattern))
      .limit(1)
      .get() !== undefined
  );
}

async function cleanOrphans(): Promise<{ deleted: string[] }> {
  const deleted: string[] = [];
  const dataDir = join(SOURCE_BASE);
  if (!existsSync(dataDir)) return { deleted };

  const entries = await readdir(dataDir, { withFileTypes: true });
  const images = entries.filter((e) => e.isFile() && /\.(png|jpe?g|webp)$/i.test(e.name));

  for (const img of images) {
    if (isReferenced(img.name)) continue;
    const path = join(dataDir, img.name);
    await rm(path, { force: true });
    deleted.push(img.name);
  }

  return { deleted };
}

async function main() {
  console.log("=== image path migration ===\n");
  await ensureUploadsDirs();

  console.log("[1/3] Moving avatars...");
  const avatarResult = await migrateSubdir("avatars");
  console.log(`  → ${avatarResult.found} found, ${avatarResult.moved} moved, ${avatarResult.skipped} skipped`);

  console.log("[2/3] Moving backgrounds...");
  const bgResult = await migrateSubdir("backgrounds");
  console.log(`  → ${bgResult.found} found, ${bgResult.moved} moved, ${bgResult.skipped} skipped`);

  console.log("[3/3] Moving personas...");
  const personaResult = await migrateSubdir("personas");
  console.log(`  → ${personaResult.found} found, ${personaResult.moved} moved, ${personaResult.skipped} skipped`);

  console.log("\n[DB] Updating stored paths...");
  updateDbPaths();
  console.log("  → done");

  console.log("\n[Cleanup] Removing orphan PNGs from public/data/...");
  const { deleted } = await cleanOrphans();
  if (deleted.length > 0) {
    for (const f of deleted) console.log(`  → deleted ${f}`);
  } else {
    console.log("  → none found");
  }

  console.log("\nMigration complete.\n");
}

main().catch((e) => {
  console.error("\nFATAL:", e);
  process.exit(1);
});
