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

export function diskPathFromStored(stored: string): string {
  if (!stored) throw new Error("Invalid stored upload path");
  const root = resolve(UPLOADS_DISK_ROOT);
  const candidate = resolve(join(UPLOADS_DISK_ROOT, stored));
  const rel = relative(root, candidate);
  if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) {
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
