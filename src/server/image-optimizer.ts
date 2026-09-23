import { createHash, randomUUID } from "node:crypto";
import { availableParallelism } from "node:os";
import type { Stats } from "node:fs";
import { createReadStream } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { mkdir, readFile, readdir, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import sharp from "sharp";
import {
  DEFAULT_IMAGE_QUALITY,
  IMAGE_QUALITIES,
  IMAGE_WIDTHS,
  isImageQuality,
  isImageWidth,
} from "@/lib/image-optimization";
import { resolveStoredUploadPath, UPLOADS_DISK_ROOT } from "@/server/uploads";
import { createLogger } from "@/features/logging";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
  assertImagePixelCount,
  isAvifMetadata,
  isSupportedRasterMetadata,
  isUnsafeImageMetadata,
  type ImageMetadata,
} from "@/server/image-limits";

const DEFAULT_CACHE_MAX_BYTES = 1024 * 1024 * 1024;
const CACHE_SCHEMA_VERSION = "3";
const INVALIDATION_TTL_MS = 10 * 60 * 1000;
const TRANSFORM_TIMEOUT_SECONDS = 5;
const MIN_CACHE_PRUNE_INTERVAL_MS = 5 * 60 * 1000;
const MAX_CONCURRENT_TRANSFORMS = Math.max(1, Math.min(4, availableParallelism() - 1));
const MAX_TRANSFORM_QUEUE = 128;
const log = createLogger("image-optimizer");
sharp.concurrency(Math.max(1, Math.min(2, availableParallelism())));

const inFlight = new Map<string, Promise<Buffer>>();
const invalidatedSourceKeys = new Set<string>();
const sourceMetadataCache = new Map<string, Promise<ImageMetadata>>();
const MAX_SOURCE_METADATA_CACHE_ENTRIES = 256;
type TransformWaiter = { resolve: () => void; reject: (error: Error) => void };
const transformWaiters: TransformWaiter[] = [];
let activeTransforms = 0;

class TransformQueueFullError extends Error {
  constructor() {
    super("Image transformation queue is full");
    this.name = "TransformQueueFullError";
  }
}

function drainTransformQueue(): void {
  while (activeTransforms < MAX_CONCURRENT_TRANSFORMS && transformWaiters.length > 0) {
    const waiter = transformWaiters.shift();
    if (!waiter) continue;
    activeTransforms++;
    waiter.resolve();
  }
}
const lastCachePruneAt = new Map<string, number>();

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

export type ImageCacheInvalidationOptions = Pick<ImageOptimizerOptions, "rootDir" | "cacheDir">;

export async function invalidateStoredImageCache(
  storedPath: string,
  options: ImageCacheInvalidationOptions = {},
): Promise<void> {
  const rootDir = options.rootDir ?? UPLOADS_DISK_ROOT;
  const sourcePath = resolveStoredPath(rootDir, storedPath);
  if (!sourcePath) return;

  const cacheDir = options.cacheDir ?? join(rootDir, ".image-cache");
  const sourceKey = sourceCacheKey(sourcePath);
  invalidatedSourceKeys.add(sourceKey);
  const timer = setTimeout(() => invalidatedSourceKeys.delete(sourceKey), INVALIDATION_TTL_MS);
  timer.unref();
  await rm(join(cacheDir, sourceKey), { recursive: true, force: true });
}

function resolveStoredPath(rootDir: string, storedPath: string): string | null {
  return resolveStoredUploadPath(rootDir, storedPath);
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
  return `"${stats.size.toString(16)}-${Math.trunc(stats.ctimeMs).toString(16)}-${Math.trunc(
    stats.mtimeMs,
  ).toString(16)}"`;
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

function notModifiedResponse(etag: string, lastModified?: Date): Response {
  return new Response(null, {
    status: 304,
    headers: {
      "cache-control": "private, max-age=300, must-revalidate",
      etag,
      ...(lastModified ? { "last-modified": lastModified.toUTCString() } : {}),
    },
  });
}

function isWebpBuffer(bytes: Buffer): boolean {
  if (
    bytes.length < 16 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return false;
  }
  const chunk = bytes.toString("ascii", 12, 16);
  return ["VP8 ", "VP8L", "VP8X"].includes(chunk) && bytes.readUInt32LE(4) + 8 === bytes.length;
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

function sourceCacheKey(sourcePath: string): string {
  return createHash("sha256")
    .update(CACHE_SCHEMA_VERSION)
    .update("\0")
    .update(sourcePath)
    .digest("hex");
}

function sourceMetadataKey(sourcePath: string, stats: Stats): string {
  return `${sourcePath}\0${stats.ctimeMs}\0${stats.mtimeMs}\0${stats.size}`;
}

async function getSourceMetadata(sourcePath: string, stats: Stats): Promise<ImageMetadata> {
  const key = sourceMetadataKey(sourcePath, stats);
  const cached = sourceMetadataCache.get(key);
  if (cached) return cached;

  const pending = (async () => {
    const metadata = await sharp(sourcePath, {
      failOn: "error",
      limitInputPixels: MAX_IMAGE_PIXELS,
      sequentialRead: true,
    }).metadata();
    if (metadata.width !== undefined && metadata.height !== undefined) {
      assertImagePixelCount(
        metadata.width,
        metadata.height,
        metadata.channels,
        metadata.depth,
        metadata.pages,
      );
    }
    return metadata;
  })();
  sourceMetadataCache.set(key, pending);
  if (sourceMetadataCache.size > MAX_SOURCE_METADATA_CACHE_ENTRIES) {
    const oldest = sourceMetadataCache.keys().next().value;
    if (oldest) sourceMetadataCache.delete(oldest);
  }

  try {
    return await pending;
  } catch (error) {
    sourceMetadataCache.delete(key);
    throw error;
  }
}

async function withTransformLimit<T>(task: () => Promise<T>): Promise<T> {
  await new Promise<void>((resolve, reject) => {
    if (transformWaiters.length >= MAX_TRANSFORM_QUEUE) {
      reject(new TransformQueueFullError());
      return;
    }
    transformWaiters.push({ resolve, reject });
    drainTransformQueue();
  });
  try {
    return await task();
  } finally {
    activeTransforms--;
    drainTransformQueue();
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
  const lastPrunedAt = lastCachePruneAt.get(cacheDir) ?? 0;
  if (now.getTime() - lastPrunedAt < MIN_CACHE_PRUNE_INTERVAL_MS) return;
  lastCachePruneAt.set(cacheDir, now.getTime());
  void pruneCache(cacheDir, maxBytes).catch(() => {});
}

async function writeCacheFile(
  cachePath: string,
  bytes: Buffer,
  sourceKey?: string,
): Promise<boolean> {
  if (sourceKey && invalidatedSourceKeys.has(sourceKey)) return false;
  const temporaryPath = `${cachePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(temporaryPath, bytes, { flag: "wx" });
    if (sourceKey && invalidatedSourceKeys.has(sourceKey)) {
      await rm(temporaryPath, { force: true }).catch(() => {});
      return false;
    }
    await rename(temporaryPath, cachePath);
    return true;
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    log.warn(
      "cache write failed",
      undefined,
      error instanceof Error ? error : new Error(String(error)),
    );
    return false;
  }
}

type VariantIdentity = {
  cacheKey: string;
  sourceKey: string;
  cachePath: string;
};

type VariantResult = {
  bytes: Buffer;
  cacheKey: string;
  cacheHit: boolean;
};

function getVariantIdentity(
  sourcePath: string,
  storedPath: string,
  cacheDir: string,
  width: number,
  quality: number,
  stats: Stats,
): VariantIdentity {
  const sourceKey = sourceCacheKey(sourcePath);
  const cacheKey = createHash("sha256")
    .update(sourceKey)
    .update("\0")
    .update(cacheDir)
    .update("\0")
    .update(String(stats.ctimeMs))
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
  return {
    cacheKey,
    sourceKey,
    cachePath: join(cacheDir, sourceKey, `${cacheKey}.webp`),
  };
}

async function readCachedVariant(identity: VariantIdentity): Promise<VariantResult | null> {
  try {
    const bytes = await readFile(identity.cachePath);
    if (!isWebpBuffer(bytes)) {
      await rm(identity.cachePath, { force: true, recursive: true }).catch(() => {});
      return null;
    }
    void utimes(identity.cachePath, new Date(), new Date()).catch(() => {});
    return { bytes, cacheKey: identity.cacheKey, cacheHit: true };
  } catch {
    // A missing, unreadable, or partially written cache entry is a miss.
    return null;
  }
}

async function transformVariant(
  sourcePath: string,
  width: number,
  quality: number,
  identity: VariantIdentity,
): Promise<VariantResult> {
  const existing = inFlight.get(identity.cacheKey);
  if (existing) return { bytes: await existing, cacheKey: identity.cacheKey, cacheHit: true };

  const pending = withTransformLimit(async () => {
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
    await writeCacheFile(identity.cachePath, bytes, identity.sourceKey);
    return bytes;
  });
  inFlight.set(identity.cacheKey, pending);

  try {
    const bytes = await pending;
    return { bytes, cacheKey: identity.cacheKey, cacheHit: false };
  } finally {
    inFlight.delete(identity.cacheKey);
  }
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
  if (rawWidth === null) {
    if (rawQuality !== null) return errorResponse("Quality requires a width", 400);
    return serveOriginal(request, sourcePath, stats);
  }

  const width = Number(rawWidth);
  const quality = rawQuality === null ? DEFAULT_IMAGE_QUALITY : Number(rawQuality);
  if (!Number.isInteger(width) || !isImageWidth(width)) {
    return errorResponse(`Width must be one of: ${IMAGE_WIDTHS.join(", ")}`, 400);
  }
  if (!Number.isInteger(quality) || !isImageQuality(quality)) {
    return errorResponse(`Quality must be one of: ${IMAGE_QUALITIES.join(", ")}`, 400);
  }

  let identity = getVariantIdentity(sourcePath, storedPath, cacheDir, width, quality, stats);
  let variant = await readCachedVariant(identity);

  if (!variant) {
    let metadata: ImageMetadata;
    try {
      metadata = await getSourceMetadata(sourcePath, stats);
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
        : serveOriginal(request, sourcePath, stats, metadata);
    }
    if (stats.size < 10 * 1024 && (metadata.format === "webp" || isAvifMetadata(metadata))) {
      return serveOriginal(request, sourcePath, stats, metadata);
    }
    const sourceWidth = metadata.autoOrient?.width ?? metadata.width;
    if (
      (sourceWidth ?? width) <= width &&
      (metadata.format === "webp" || isAvifMetadata(metadata))
    ) {
      return serveOriginal(request, sourcePath, stats, metadata);
    }

    const effectiveWidth =
      sourceWidth !== undefined && sourceWidth > 0 && sourceWidth < width ? sourceWidth : width;
    if (effectiveWidth !== width) {
      identity = getVariantIdentity(
        sourcePath,
        storedPath,
        cacheDir,
        effectiveWidth,
        quality,
        stats,
      );
      variant = await readCachedVariant(identity);
    }

    if (!variant) {
      try {
        variant = await transformVariant(sourcePath, effectiveWidth, quality, identity);
      } catch (error) {
        if (error instanceof TransformQueueFullError) {
          return errorResponse("Image transformation queue is full", 503);
        }
        return errorResponse("Image transformation failed", 422);
      }
    }
  }

  const etag = `"${variant.cacheKey}"`;
  if (isNotModified(request, stats, etag, false)) {
    return notModifiedResponse(etag);
  }
  const body = new Uint8Array(
    variant.bytes.buffer,
    variant.bytes.byteOffset,
    variant.bytes.byteLength,
  );
  return new Response(body as unknown as BodyInit, {
    headers: {
      "cache-control": "private, max-age=300, must-revalidate",
      "content-length": String(variant.bytes.byteLength),
      "content-type": "image/webp",
      "x-content-type-options": "nosniff",
      etag,
      "x-image-cache": variant.cacheHit ? "hit" : "miss",
    },
  });
}

async function serveOriginal(
  request: Request,
  sourcePath: string,
  stats: Stats,
  knownMetadata?: ImageMetadata,
): Promise<Response> {
  const etag = sourceEtag(stats);
  // A date-only validator cannot detect a replacement that preserves mtime; use the ETag.
  if (isNotModified(request, stats, etag, false)) {
    return notModifiedResponse(etag, new Date(stats.mtimeMs));
  }

  try {
    const metadata = knownMetadata ?? (await getSourceMetadata(sourcePath, stats));
    if (isUnsafeImageMetadata(metadata)) {
      return errorResponse("Unsupported image format", 415);
    }
    const body = Readable.toWeb(createReadStream(sourcePath));
    return new Response(body as unknown as BodyInit, {
      headers: {
        "cache-control": "private, max-age=300, must-revalidate",
        "content-length": String(stats.size),
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
