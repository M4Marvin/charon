import { createHash, randomUUID } from "node:crypto";
import { availableParallelism } from "node:os";
import type { Stats } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { mkdir, readFile, readdir, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import sharp from "sharp";
import {
  DEFAULT_IMAGE_QUALITY,
  IMAGE_QUALITIES,
  IMAGE_WIDTHS,
  isImageQuality,
  isImageWidth,
} from "@/lib/image-optimization";
import { UPLOADS_DISK_ROOT } from "@/server/uploads";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
  isAvifMetadata,
  isSupportedRasterMetadata,
  isUnsafeImageMetadata,
  type ImageMetadata,
} from "@/server/image-limits";

const DEFAULT_CACHE_MAX_BYTES = 1024 * 1024 * 1024;
const CACHE_SCHEMA_VERSION = "1";
const TRANSFORM_TIMEOUT_SECONDS = 5;
const MIN_CACHE_PRUNE_INTERVAL_MS = 5 * 60 * 1000;
const MAX_CONCURRENT_TRANSFORMS = Math.max(1, Math.min(4, availableParallelism() - 1));

const inFlight = new Map<string, Promise<Buffer>>();
const transformWaiters: Array<() => void> = [];
let activeTransforms = 0;
let lastCachePruneAt = 0;

export type ImageOptimizerOptions = {
  rootDir?: string;
  cacheDir?: string;
  maxCacheBytes?: number;
  now?: () => Date;
};

function cacheMaxBytes(): number {
  const configuredMb = Number(process.env.IMAGE_CACHE_MAX_MB ?? 1024);
  if (!Number.isFinite(configuredMb) || configuredMb <= 0) return DEFAULT_CACHE_MAX_BYTES;
  return Math.floor(configuredMb * 1024 * 1024);
}

function resolveStoredPath(rootDir: string, storedPath: string): string | null {
  if (!storedPath || isAbsolute(storedPath)) return null;
  const root = resolve(rootDir);
  const candidate = resolve(root, storedPath);
  const rel = relative(root, candidate);
  if (rel.startsWith(`..${sep}`) || rel === "..") return null;
  return candidate;
}

function errorResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

function sourceEtag(stats: Stats): string {
  return `"${stats.size.toString(16)}-${Math.trunc(stats.mtimeMs).toString(16)}"`;
}

function isNotModified(
  request: Request,
  stats: Stats,
  etag: string,
  allowModifiedSince = true,
): boolean {
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) {
    const normalizedEtag = etag.replace(/^W\//, "");
    return ifNoneMatch
      .split(",")
      .map((value) => value.trim().replace(/^W\//, ""))
      .some((value) => value === "*" || value === normalizedEtag);
  }

  if (!allowModifiedSince) return false;
  const ifModifiedSince = request.headers.get("if-modified-since");
  if (!ifModifiedSince) return false;
  const modified = Date.parse(ifModifiedSince);
  return Number.isFinite(modified) && Math.floor(stats.mtimeMs / 1000) * 1000 <= modified;
}

function notModifiedResponse(etag: string, immutable: boolean, lastModified?: Date): Response {
  return new Response(null, {
    status: 304,
    headers: {
      "cache-control": immutable
        ? "private, max-age=31536000, immutable"
        : "private, max-age=300, must-revalidate",
      etag,
      ...(lastModified ? { "last-modified": lastModified.toUTCString() } : {}),
    },
  });
}

function isWebpBuffer(bytes: Buffer): boolean {
  return (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  );
}

function contentTypeForMetadata(metadata: ImageMetadata): string {
  if (isAvifMetadata(metadata)) return "image/avif";
  switch (metadata.format) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "tiff":
      return "image/tiff";
    default:
      return "application/octet-stream";
  }
}

async function withTransformLimit<T>(task: () => Promise<T>): Promise<T> {
  if (activeTransforms >= MAX_CONCURRENT_TRANSFORMS) {
    await new Promise<void>((resolveWaiter) => transformWaiters.push(resolveWaiter));
  }
  activeTransforms++;
  try {
    return await task();
  } finally {
    activeTransforms--;
    transformWaiters.shift()?.();
  }
}

async function walkCacheFiles(
  root: string,
): Promise<Array<{ path: string; size: number; accessedAt: number }>> {
  const files: Array<{ path: string; size: number; accessedAt: number }> = [];
  const pending = [root];

  while (pending.length > 0) {
    const dir = pending.pop();
    if (!dir) continue;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        pending.push(path);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".webp")) continue;
      try {
        const stats = await stat(path);
        files.push({ path, size: stats.size, accessedAt: stats.atimeMs });
      } catch {}
    }
  }

  return files;
}

async function pruneCache(cacheDir: string, maxBytes: number): Promise<void> {
  const files = await walkCacheFiles(cacheDir);
  let total = files.reduce((sum, file) => sum + file.size, 0);
  if (total <= maxBytes) return;

  files.sort((a, b) => a.accessedAt - b.accessedAt);
  for (const file of files) {
    if (total <= maxBytes) break;
    try {
      await rm(file.path, { force: true });
      total -= file.size;
    } catch {}
  }
}

function scheduleCachePrune(cacheDir: string, maxBytes: number, now: Date): void {
  if (now.getTime() - lastCachePruneAt < MIN_CACHE_PRUNE_INTERVAL_MS) return;
  lastCachePruneAt = now.getTime();
  void pruneCache(cacheDir, maxBytes).catch(() => {});
}

async function writeCacheFile(cachePath: string, bytes: Buffer): Promise<boolean> {
  const temporaryPath = `${cachePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(temporaryPath, bytes, { flag: "wx" });
    await rename(temporaryPath, cachePath);
    return true;
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    console.warn("[image-optimizer] cache write failed", error);
    return false;
  }
}

async function readOrTransformVariant(
  sourcePath: string,
  storedPath: string,
  cacheDir: string,
  width: number,
  quality: number,
  stats: Stats,
): Promise<{ bytes: Buffer; cacheKey: string; cacheHit: boolean }> {
  const cacheKey = createHash("sha256")
    .update(CACHE_SCHEMA_VERSION)
    .update("\0")
    .update(sourcePath)
    .update("\0")
    .update(storedPath)
    .update("\0")
    .update(String(stats.mtimeMs))
    .update("\0")
    .update(String(stats.size))
    .update("\0")
    .update(String(width))
    .update("\0")
    .update(String(quality))
    .digest("hex");
  const cachePath = join(cacheDir, cacheKey.slice(0, 2), `${cacheKey}.webp`);

  try {
    const bytes = await readFile(cachePath);
    if (!isWebpBuffer(bytes)) {
      await rm(cachePath, { force: true, recursive: true }).catch(() => {});
    } else {
      void utimes(cachePath, new Date(), new Date()).catch(() => {});
      return { bytes, cacheKey, cacheHit: true };
    }
  } catch {
    // A missing, unreadable, or partially written cache entry is a miss.
  }

  const existing = inFlight.get(cacheKey);
  if (existing) return { bytes: await existing, cacheKey, cacheHit: true };

  const pending = withTransformLimit(async () => {
    try {
      const bytes = await sharp(sourcePath, {
        failOn: "error",
        limitInputPixels: MAX_IMAGE_PIXELS,
        sequentialRead: true,
      })
        .autoOrient()
        .resize({
          width,
          fit: "inside",
          withoutEnlargement: true,
          fastShrinkOnLoad: true,
        })
        .webp({ quality, effort: 4, smartSubsample: true })
        .timeout({ seconds: TRANSFORM_TIMEOUT_SECONDS })
        .toBuffer();
      await writeCacheFile(cachePath, bytes);
      return bytes;
    } finally {
      inFlight.delete(cacheKey);
    }
  });
  inFlight.set(cacheKey, pending);

  return { bytes: await pending, cacheKey, cacheHit: false };
}

export async function serveStoredImage(
  request: Request,
  storedPath: string,
  options: ImageOptimizerOptions = {},
): Promise<Response> {
  const rootDir = options.rootDir ?? UPLOADS_DISK_ROOT;
  const cacheDir = options.cacheDir ?? join(rootDir, ".image-cache");
  const maxCacheBytes = options.maxCacheBytes ?? cacheMaxBytes();
  const now = options.now ?? (() => new Date());
  const sourcePath = resolveStoredPath(rootDir, storedPath);
  if (!sourcePath) return errorResponse("Invalid image path", 400);

  let stats: Stats;
  try {
    stats = await stat(sourcePath);
  } catch {
    return errorResponse("File missing", 404);
  }
  if (!stats.isFile()) return errorResponse("File missing", 404);
  if (stats.size > MAX_IMAGE_BYTES) return errorResponse("Image is too large", 413);
  scheduleCachePrune(cacheDir, maxCacheBytes, now());

  const url = new URL(request.url);
  const rawWidth = url.searchParams.get("w");
  const rawQuality = url.searchParams.get("q");
  const sourceVersion = storedPath.split(/[\\/]/).at(-1);
  const immutable = url.searchParams.get("v") === sourceVersion;
  if (rawWidth === null) {
    if (rawQuality !== null) return errorResponse("Quality requires a width", 400);
    return serveOriginal(request, sourcePath, stats, undefined, immutable);
  }

  const width = Number(rawWidth);
  const quality = rawQuality === null ? DEFAULT_IMAGE_QUALITY : Number(rawQuality);
  if (!Number.isInteger(width) || !isImageWidth(width)) {
    return errorResponse(`Width must be one of: ${IMAGE_WIDTHS.join(", ")}`, 400);
  }
  if (!Number.isInteger(quality) || !isImageQuality(quality)) {
    return errorResponse(`Quality must be one of: ${IMAGE_QUALITIES.join(", ")}`, 400);
  }

  let metadata: ImageMetadata;
  try {
    metadata = await sharp(sourcePath, {
      failOn: "error",
      limitInputPixels: MAX_IMAGE_PIXELS,
      sequentialRead: true,
    }).metadata();
  } catch {
    return errorResponse("Invalid image", 422);
  }

  if (
    isUnsafeImageMetadata(metadata) ||
    !isSupportedRasterMetadata(metadata) ||
    metadata.format === "gif" ||
    (metadata.pages ?? 1) > 1
  ) {
    return isUnsafeImageMetadata(metadata)
      ? errorResponse("Unsupported image format", 415)
      : serveOriginal(request, sourcePath, stats, metadata, immutable);
  }
  if (stats.size < 10 * 1024 && (metadata.format === "webp" || isAvifMetadata(metadata))) {
    return serveOriginal(request, sourcePath, stats, metadata, immutable);
  }
  if (
    (metadata.width ?? width) <= width &&
    (metadata.format === "webp" || isAvifMetadata(metadata))
  ) {
    return serveOriginal(request, sourcePath, stats, metadata, immutable);
  }

  try {
    const variant = await readOrTransformVariant(
      sourcePath,
      storedPath,
      cacheDir,
      width,
      quality,
      stats,
    );
    const etag = `"${variant.cacheKey}"`;
    if (isNotModified(request, stats, etag, false)) {
      return notModifiedResponse(etag, immutable);
    }
    return new Response(new Uint8Array(variant.bytes), {
      headers: {
        "cache-control": immutable
          ? "private, max-age=31536000, immutable"
          : "private, max-age=300, must-revalidate",
        "content-length": String(variant.bytes.byteLength),
        "content-type": "image/webp",
        "x-content-type-options": "nosniff",
        etag,
        "x-image-cache": variant.cacheHit ? "hit" : "miss",
      },
    });
  } catch {
    return errorResponse("Image transformation failed", 422);
  }
}

async function serveOriginal(
  request: Request,
  sourcePath: string,
  stats: Stats,
  knownMetadata?: ImageMetadata,
  immutable = false,
): Promise<Response> {
  const etag = sourceEtag(stats);
  if (isNotModified(request, stats, etag)) {
    return notModifiedResponse(etag, immutable, new Date(stats.mtimeMs));
  }

  try {
    const metadata =
      knownMetadata ??
      (await sharp(sourcePath, {
        failOn: "error",
        limitInputPixels: MAX_IMAGE_PIXELS,
        sequentialRead: true,
      }).metadata());
    if (isUnsafeImageMetadata(metadata)) {
      return errorResponse("Unsupported image format", 415);
    }
    const bytes = await readFile(sourcePath);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "cache-control": immutable
          ? "private, max-age=31536000, immutable"
          : "private, max-age=300",
        "content-length": String(bytes.byteLength),
        "content-type": contentTypeForMetadata(metadata),
        "x-content-type-options": "nosniff",
        etag,
        "last-modified": new Date(stats.mtimeMs).toUTCString(),
        "x-image-cache": "source",
      },
    });
  } catch {
    return errorResponse("Invalid image", 422);
  }
}
