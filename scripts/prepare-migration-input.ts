import { lstat, mkdir, rename, rmdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const LEGACY_DIR = "public/data";
const TARGET_DIR = "data/import";

async function pathKind(path: string): Promise<"missing" | "directory" | "symlink" | "other"> {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) return "symlink";
    return stats.isDirectory() ? "directory" : "other";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return "missing";
    if (code === "ENOTDIR") return "other";
    throw error;
  }
}

export async function prepareMigrationInput(
  cwd = process.cwd(),
): Promise<"created" | "moved" | "already-prepared"> {
  const legacyPath = resolve(cwd, LEGACY_DIR);
  const targetPath = resolve(cwd, TARGET_DIR);
  const [legacyKind, targetKind, publicKind, dataKind] = await Promise.all([
    pathKind(legacyPath),
    pathKind(targetPath),
    pathKind(resolve(cwd, "public")),
    pathKind(resolve(cwd, "data")),
  ]);

  if (
    legacyKind === "symlink" ||
    targetKind === "symlink" ||
    publicKind === "symlink" ||
    dataKind === "symlink"
  ) {
    throw new Error("Migration input directories must not be symlinks");
  }
  if (
    legacyKind === "other" ||
    targetKind === "other" ||
    publicKind === "other" ||
    dataKind === "other"
  ) {
    throw new Error("Migration input paths must be directories");
  }
  if (legacyKind === "missing") {
    if (targetKind === "missing") await mkdir(targetPath, { recursive: true });
    return targetKind === "directory" ? "already-prepared" : "created";
  }
  if (targetKind !== "missing") {
    throw new Error(
      `Both ${LEGACY_DIR} and ${TARGET_DIR} exist; merge them manually before preparing migration input`,
    );
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await rename(legacyPath, targetPath);
  await rmdir(resolve(cwd, "public")).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY" && error.code !== "ENOTDIR") {
      throw error;
    }
  });
  return "moved";
}

async function main(): Promise<void> {
  const result = await prepareMigrationInput();
  const message = {
    created: `Created empty ${TARGET_DIR}/`,
    moved: `Moved ${LEGACY_DIR}/ to ${TARGET_DIR}/`,
    "already-prepared": `${TARGET_DIR}/ is already prepared`,
  }[result];
  console.log(message);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
