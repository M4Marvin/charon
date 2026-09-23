import { mkdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

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

export function resolveStoredUploadPath(rootDir: string, stored: string): string | null {
  if (!stored || isAbsolute(stored)) return null;

  const root = resolve(rootDir);
  const uploadsRoot = resolve(root, UPLOADS_PUBLIC_PREFIX);
  const candidate = resolve(root, stored);
  const rel = relative(uploadsRoot, candidate);
  if (!rel || isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) return null;

  const parts = rel.split(sep);
  if (parts.length !== 2 || !isUploadSubdir(parts[0]) || !parts[1]) return null;
  return candidate;
}

export function diskPathFromStored(stored: string): string {
  if (!resolveStoredUploadPath(UPLOADS_DISK_ROOT, stored)) {
    throw new Error("Invalid stored upload path");
  }
  return join(UPLOADS_DISK_ROOT, stored);
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
