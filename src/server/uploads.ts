import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export const UPLOADS_DISK_ROOT = "data";
export const UPLOADS_PUBLIC_PREFIX = "uploads";

export const UPLOADS_SUBDIRS = {
  avatars: "avatars",
  backgrounds: "backgrounds",
  personas: "personas",
} as const;

export type UploadSubdir = keyof typeof UPLOADS_SUBDIRS;

export function diskPathFromStored(stored: string): string {
  return join(UPLOADS_DISK_ROOT, stored);
}

export function storedPathFromDiskComponents(
  subdir: UploadSubdir,
  filename: string,
): string {
  return join(UPLOADS_PUBLIC_PREFIX, UPLOADS_SUBDIRS[subdir], filename);
}

export async function ensureUploadsDirs(): Promise<void> {
  for (const subdir of Object.values(UPLOADS_SUBDIRS)) {
    await mkdir(join(UPLOADS_DISK_ROOT, UPLOADS_PUBLIC_PREFIX, subdir), {
      recursive: true,
    });
  }
}

export function contentTypeForPath(storedPath: string): string {
  const ext = storedPath.match(/\.(\w+)$/)?.[1]?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      return "image/png";
  }
}