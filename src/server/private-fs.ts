import { lstatSync } from "node:fs";
import { mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { MAX_IMAGE_BYTES } from "@/server/image-limits";

export const UPLOADS_DISK_ROOT = "data";
export const UPLOADS_PUBLIC_PREFIX = "uploads";

export const UPLOADS_SUBDIRS = {
  avatars: "avatars",
  backgrounds: "backgrounds",
  personas: "personas",
} as const;

export type UploadSubdir = keyof typeof UPLOADS_SUBDIRS;

export function isUploadSubdir(value: string): value is UploadSubdir {
  return Object.values(UPLOADS_SUBDIRS).includes(value as UploadSubdir);
}

export function isWithin(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === "" ||
    (pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot))
  );
}

export function hasSymlinkComponent(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  if (pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === ".." || isAbsolute(pathFromRoot)) {
    return true;
  }

  const parts = pathFromRoot ? pathFromRoot.split(sep) : [];
  let current = root;
  for (const part of [".", ...parts]) {
    if (part !== ".") current = join(current, part);
    const stats = lstatSync(current, { throwIfNoEntry: false });
    if (stats?.isSymbolicLink()) return true;
  }
  return false;
}

export function resolveStoredUploadPath(rootDir: string, stored: string): string | null {
  if (!stored || isAbsolute(stored)) return null;

  const root = resolve(rootDir);
  const uploadsRoot = resolve(root, UPLOADS_PUBLIC_PREFIX);
  const candidate = resolve(root, stored);
  const rel = relative(uploadsRoot, candidate);
  if (!rel || isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) return null;
  if (hasSymlinkComponent(root, candidate)) return null;

  const parts = rel.split(sep);
  if (parts.length !== 2 || !isUploadSubdir(parts[0]) || !parts[1]) return null;
  return candidate;
}

export function diskPathFromStored(stored: string): string {
  const resolved = resolveStoredUploadPath(UPLOADS_DISK_ROOT, stored);
  if (!resolved) throw new Error("Invalid stored upload path");
  return resolved;
}

export function storedPathFromDiskComponents(subdir: UploadSubdir, filename: string): string {
  return join(UPLOADS_PUBLIC_PREFIX, UPLOADS_SUBDIRS[subdir], filename);
}

export async function ensureUploadsDirs(): Promise<void> {
  for (const subdir of Object.values(UPLOADS_SUBDIRS)) {
    await mkdir(join(UPLOADS_DISK_ROOT, UPLOADS_PUBLIC_PREFIX, subdir), {
      recursive: true,
    });
  }
}

/** Read a private file without allocating past the configured byte ceiling. */
export async function readPrivateFile(
  filePath: string,
  maxBytes = MAX_IMAGE_BYTES,
): Promise<Buffer> {
  const handle = await open(filePath, "r");
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) throw new Error("Private path is not a regular file");
    if (stats.size > maxBytes) throw new Error("Private file exceeds the allowed size limit");

    const bytes = Buffer.allocUnsafe(stats.size);
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (result.bytesRead === 0) throw new Error("Private file changed while reading");
      offset += result.bytesRead;
    }

    const extra = Buffer.allocUnsafe(1);
    const result = await handle.read(extra, 0, 1, bytes.length);
    if (result.bytesRead > 0) throw new Error("Private file exceeds the allowed size limit");
    return bytes;
  } finally {
    await handle.close();
  }
}

export async function writePrivateFileAtomic(filePath: string, bytes: Uint8Array): Promise<void> {
  const tempPath = `${filePath}.tmp-${randomUUID()}`;
  try {
    await writeFile(tempPath, bytes, { flag: "wx" });
    await rename(tempPath, filePath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => {});
  }
}

export function resolveMigrationDirectory(dataRoot: string, directory: string): string | null {
  try {
    const realRoot = lstatSync(resolve(dataRoot), { throwIfNoEntry: false });
    if (!realRoot?.isDirectory() || realRoot.isSymbolicLink()) return null;

    const root = resolve(dataRoot);
    const candidate = resolve(directory);
    if (!isWithin(root, candidate) || hasSymlinkComponent(root, candidate)) return null;
    const candidateStats = lstatSync(candidate, { throwIfNoEntry: false });
    return candidateStats?.isDirectory() && !candidateStats.isSymbolicLink() ? candidate : null;
  } catch {
    return null;
  }
}

export function resolveMigrationFile(dataRoot: string, filePath: string): string | null {
  const directory = resolveMigrationDirectory(dataRoot, resolve(filePath, ".."));
  if (!directory) return null;
  const candidate = resolve(filePath);
  if (!isWithin(directory, candidate) || hasSymlinkComponent(directory, candidate)) return null;
  const stats = lstatSync(candidate, { throwIfNoEntry: false });
  return stats?.isFile() && !stats.isSymbolicLink() ? candidate : null;
}
