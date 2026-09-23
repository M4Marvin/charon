// Migrate uploaded images from data/import/ to data/uploads/
// Changes the backend storage location and DB paths to match.
// Run with: pnpm run prepare:migration && pnpm run migrate:image-paths
//
// Idempotent — safe to re-run. Skips already-moved files and already-updated rows.

import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq, like } from "drizzle-orm";

import { db } from "@/db";
import { characters, backgrounds, personas } from "@/db/schema";
import { validateUploadedImage } from "@/server/image-limits";
import { readMigrationFile, resolveMigrationDirectory } from "./migration-io";
import {
  ensureUploadsDirs,
  diskPathFromStored,
  storedPathFromDiskComponents,
  writePrivateFileAtomic,
  UPLOADS_SUBDIRS,
  type UploadSubdir,
} from "@/server/uploads";

const SOURCE_BASE = "data/import";

type Counts = { found: number; moved: number; skipped: number; failed: number };
type MigrationResult = Counts & { verified: Set<string> };

async function migrateSubdir(subdir: UploadSubdir): Promise<MigrationResult> {
  const counts: Counts = { found: 0, moved: 0, skipped: 0, failed: 0 };
  const verified = new Set<string>();
  const sourceDir = resolveMigrationDirectory(
    SOURCE_BASE,
    join(SOURCE_BASE, UPLOADS_SUBDIRS[subdir]),
  );
  if (!sourceDir) return { ...counts, verified };

  const entries = await readdir(sourceDir, { withFileTypes: true });
  const images = entries.filter(
    (e) => e.isFile() && /\.(png|jpe?g|webp|gif|tiff?|avif)$/i.test(e.name),
  );
  counts.found = images.length;

  for (const img of images) {
    const src = join(sourceDir, img.name);
    const stored = storedPathFromDiskComponents(subdir, img.name);
    const dst = diskPathFromStored(stored);

    try {
      const sourceBytes = await readMigrationFile(src);
      await validateUploadedImage(sourceBytes);

      if (existsSync(dst)) {
        const destinationBytes = await readMigrationFile(dst);
        let destinationIsValid = true;
        try {
          await validateUploadedImage(destinationBytes);
        } catch {
          destinationIsValid = false;
        }
        if (destinationIsValid) {
          if (!sourceBytes.equals(destinationBytes)) {
            throw new Error(`Refusing to overwrite different destination: ${dst}`);
          }
          verified.add(stored);
          counts.skipped++;
          continue;
        }
        await rm(dst, { force: true });
      }

      await writePrivateFileAtomic(dst, sourceBytes);
      verified.add(stored);
      counts.moved++;
    } catch (error) {
      console.warn(`  ! ${subdir}/${img.name}: ${(error as Error).message}`);
      counts.failed++;
    }
  }

  return { ...counts, verified };
}

function verifiedPath(
  path: string | null,
  oldPrefix: string,
  newPrefix: string,
  verified: Set<string>,
): string | null {
  if (!path) return null;
  const next = path.replace(oldPrefix, newPrefix);
  if (!verified.has(next)) {
    console.warn(`  ! skipped unverified path: ${path}`);
    return null;
  }
  try {
    diskPathFromStored(next);
  } catch {
    console.warn(`  ! skipped invalid path: ${path}`);
    return null;
  }
  return next;
}

function updateDbPaths(verified: Set<string>): void {
  const chars = db
    .select({ id: characters.id, p: characters.imagePath })
    .from(characters)
    .where(like(characters.imagePath, "data/avatars/%"))
    .all();
  for (const c of chars) {
    const next = verifiedPath(c.p, "data/avatars/", "uploads/avatars/", verified);
    if (next) {
      db.update(characters).set({ imagePath: next }).where(eq(characters.id, c.id)).run();
    }
  }

  const bgs = db
    .select({ id: backgrounds.id, p: backgrounds.path })
    .from(backgrounds)
    .where(like(backgrounds.path, "data/backgrounds/%"))
    .all();
  for (const b of bgs) {
    const next = verifiedPath(b.p, "data/backgrounds/", "uploads/backgrounds/", verified);
    if (next) {
      db.update(backgrounds).set({ path: next }).where(eq(backgrounds.id, b.id)).run();
    }
  }

  const pers = db
    .select({ id: personas.id, p: personas.iconPath })
    .from(personas)
    .where(like(personas.iconPath, "data/personas/%"))
    .all();
  for (const p of pers) {
    const next = verifiedPath(p.p, "data/personas/", "uploads/personas/", verified);
    if (next) {
      db.update(personas).set({ iconPath: next }).where(eq(personas.id, p.id)).run();
    }
  }
}

function isReferenced(path: string): boolean {
  return (
    db
      .select({ id: characters.id })
      .from(characters)
      .where(eq(characters.imagePath, path))
      .limit(1)
      .get() !== undefined ||
    db
      .select({ id: backgrounds.id })
      .from(backgrounds)
      .where(eq(backgrounds.path, path))
      .limit(1)
      .get() !== undefined ||
    db
      .select({ id: personas.id })
      .from(personas)
      .where(eq(personas.iconPath, path))
      .limit(1)
      .get() !== undefined
  );
}

async function cleanOrphans(): Promise<{ deleted: string[] }> {
  const deleted: string[] = [];

  for (const subdir of Object.values(UPLOADS_SUBDIRS)) {
    const dataDir = resolveMigrationDirectory(SOURCE_BASE, join(SOURCE_BASE, subdir));
    if (!dataDir) continue;

    const entries = await readdir(dataDir, { withFileTypes: true });
    const images = entries.filter(
      (e) => e.isFile() && /\.(png|jpe?g|webp|gif|tiff?|avif)$/i.test(e.name),
    );

    for (const img of images) {
      const legacyPath = join("data", subdir, img.name);
      if (isReferenced(legacyPath)) continue;
      const path = join(dataDir, img.name);
      await rm(path, { force: true });
      deleted.push(join(subdir, img.name));
    }
  }

  return { deleted };
}

async function main() {
  console.log("=== image path migration ===\n");
  await ensureUploadsDirs();

  const verified = new Set<string>();

  console.log("[1/3] Moving avatars...");
  const avatarResult = await migrateSubdir("avatars");
  for (const path of avatarResult.verified) verified.add(path);
  console.log(
    `  → ${avatarResult.found} found, ${avatarResult.moved} moved, ${avatarResult.skipped} skipped, ${avatarResult.failed} failed`,
  );

  console.log("[2/3] Moving backgrounds...");
  const bgResult = await migrateSubdir("backgrounds");
  for (const path of bgResult.verified) verified.add(path);
  console.log(
    `  → ${bgResult.found} found, ${bgResult.moved} moved, ${bgResult.skipped} skipped, ${bgResult.failed} failed`,
  );

  console.log("[3/3] Moving personas...");
  const personaResult = await migrateSubdir("personas");
  for (const path of personaResult.verified) verified.add(path);
  console.log(
    `  → ${personaResult.found} found, ${personaResult.moved} moved, ${personaResult.skipped} skipped, ${personaResult.failed} failed`,
  );

  console.log("\n[DB] Updating stored paths...");
  updateDbPaths(verified);
  console.log("  → done");

  console.log("\n[Cleanup] Removing migrated/orphan image files from public/data/...");
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
