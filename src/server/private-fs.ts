import { constants, lstatSync } from "node:fs";
import { lstat, mkdir, open, readdir, rename, rm, utimes, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Dirent, Stats } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

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
    try {
      const stats = lstatSync(current, { throwIfNoEntry: false });
      if (stats?.isSymbolicLink()) return true;
    } catch {
      return true;
    }
  }
  return false;
}

/** Resolve a path below a private root while rejecting traversal and symlink components. */
export function resolvePrivatePath(rootDir: string, candidate: string): string | null {
  const root = resolve(rootDir);
  const path = isAbsolute(candidate) ? resolve(candidate) : resolve(root, candidate);
  if (!isWithin(root, path) || hasSymlinkComponent(root, path)) return null;
  return path;
}

function assertPrivatePath(rootDir: string | undefined, filePath: string): void {
  if (!rootDir) return;
  if (!resolvePrivatePath(rootDir, filePath)) {
    throw new Error("Private path escapes its configured root");
  }
}

const READ_ONLY_FLAGS = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);

async function openPrivateFile(
  filePath: string,
  maxBytes: number,
  rootDir?: string,
): Promise<FileHandle> {
  assertPrivatePath(rootDir, filePath);
  const handle = await open(filePath, READ_ONLY_FLAGS);
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) throw new Error("Private path is not a regular file");
    if (stats.size > maxBytes) throw new Error("Private file exceeds the allowed size limit");
    return handle;
  } catch (error) {
    await handle.close().catch(() => {});
    throw error;
  }
}

export function resolvePrivateDirectory(rootDir: string, directory: string): string | null {
  return resolvePrivatePath(rootDir, directory);
}

export function resolvePrivateFilePath(rootDir: string, filePath: string): string | null {
  return resolvePrivatePath(rootDir, filePath);
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
  const root = resolve(UPLOADS_DISK_ROOT);
  for (const subdir of Object.values(UPLOADS_SUBDIRS)) {
    const relativeDir = join(UPLOADS_PUBLIC_PREFIX, UPLOADS_SUBDIRS[subdir]);
    if (!resolvePrivatePath(root, relativeDir)) {
      throw new Error("Uploads directory escapes its private root");
    }
    await mkdir(join(UPLOADS_DISK_ROOT, relativeDir), { recursive: true });
    if (!resolvePrivatePath(root, relativeDir)) {
      throw new Error("Uploads directory is not private");
    }
  }
}

/** Read a private file without allocating past the configured byte ceiling. */
export async function readPrivateFile(
  filePath: string,
  maxBytes = MAX_IMAGE_BYTES,
  rootDir?: string,
): Promise<Buffer> {
  const handle = await openPrivateFile(filePath, maxBytes, rootDir);
  try {
    const stats = await handle.stat();
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

export async function statPrivateFile(
  filePath: string,
  maxBytes = MAX_IMAGE_BYTES,
  rootDir?: string,
): Promise<Stats> {
  const handle = await openPrivateFile(filePath, maxBytes, rootDir);
  try {
    return await handle.stat();
  } finally {
    await handle.close();
  }
}

export async function createPrivateReadStream(
  filePath: string,
  maxBytes = MAX_IMAGE_BYTES,
  rootDir?: string,
) {
  const handle = await openPrivateFile(filePath, maxBytes, rootDir);
  try {
    const stats = await handle.stat();
    return handle.createReadStream({
      autoClose: true,
      start: 0,
      end: stats.size > 0 ? stats.size - 1 : 0,
    });
  } catch (error) {
    await handle.close().catch(() => {});
    throw error;
  }
}

export async function readPrivateDirectory(directory: string, rootDir?: string): Promise<Dirent[]> {
  assertPrivatePath(rootDir, directory);
  const stats = await lstat(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error("Private path is not a directory");
  }
  return readdir(directory, { withFileTypes: true });
}

export async function touchPrivateFile(filePath: string, rootDir?: string): Promise<void> {
  assertPrivatePath(rootDir, filePath);
  const now = new Date();
  await utimes(filePath, now, now);
}

export async function removePrivatePath(
  filePath: string,
  options: { rootDir?: string; recursive?: boolean } = {},
): Promise<void> {
  assertPrivatePath(options.rootDir, filePath);
  await rm(filePath, { force: true, recursive: options.recursive });
}

export async function writePrivateFileAtomic(
  filePath: string,
  bytes: Uint8Array,
  options: {
    rootDir?: string;
    beforeCommit?: () => boolean | Promise<boolean>;
  } = {},
): Promise<boolean> {
  assertPrivatePath(options.rootDir, filePath);
  await mkdir(dirname(filePath), { recursive: true });
  assertPrivatePath(options.rootDir, filePath);
  const tempPath = `${filePath}.tmp-${randomUUID()}`;
  try {
    await writeFile(tempPath, bytes, { flag: "wx" });
    if (options.beforeCommit && !(await options.beforeCommit())) return false;
    await rename(tempPath, filePath);
    return true;
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
