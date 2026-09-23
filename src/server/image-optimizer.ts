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

const DEFAULT_CACHE_MAX_BYTES = 1024 * 1024 * 1024;
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_INPUT_PIXELS = 100_000_000;
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

type ImageMetadata = {
  format?: string;
  width?: number;
  height?: number;
  pages?: number;
};

function contentTypeForFormat(format?: string): string {
  switch (format) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    case "gif":
      return "image/gif";
    case "tiff":
      return "image/tiff";
    case "svg":
      return "image/svg+xml";
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
      if (!entry.isFile()) continue;
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

async function writeCacheFile(cachePath: string, bytes: Buffer): Promise<void> {
  await mkdir(dirname(cachePath), { recursive: true });
  const temporaryPath = `${cachePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, bytes, { flag: "wx" });
    await rename(temporaryPath, cachePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
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
    void utimes(cachePath, new Date(), new Date()).catch(() => {});
    return { bytes, cacheKey, cacheHit: true };
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }

  const existing = inFlight.get(cacheKey);
  if (existing) return { bytes: await existing, cacheKey, cacheHit: true };

  const pending = withTransformLimit(async () => {
    try {
      const bytes = await sharp(sourcePath, {
        failOn: "error",
        limitInputPixels: MAX_INPUT_PIXELS,
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
  if (stats.size > MAX_SOURCE_BYTES) return errorResponse("Image is too large", 413);

  const url = new URL(request.url);
  const rawWidth = url.searchParams.get("w");
  const rawQuality = url.searchParams.get("q");
  if (rawWidth === null) {
    if (rawQuality !== null) return errorResponse("Quality requires a width", 400);
    return serveOriginal(sourcePath, stats);
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
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true,
    }).metadata();
  } catch {
    return errorResponse("Invalid image", 422);
  }

  const supported = new Set(["jpeg", "png", "webp", "avif", "tiff"]);
  if (!supported.has(metadata.format ?? "") || (metadata.pages ?? 1) > 1) {
    return serveOriginal(sourcePath, stats, metadata);
  }
  if (stats.size < 10 * 1024 && (metadata.format === "webp" || metadata.format === "avif")) {
    return serveOriginal(sourcePath, stats, metadata);
  }
  if (
    (metadata.width ?? width) <= width &&
    (metadata.format === "webp" || metadata.format === "avif")
  ) {
    return serveOriginal(sourcePath, stats, metadata);
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
    if (!variant.cacheHit) scheduleCachePrune(cacheDir, maxCacheBytes, now());

    const immutable = url.searchParams.has("v");
    return new Response(new Uint8Array(variant.bytes), {
      headers: {
        "cache-control": immutable
          ? "private, max-age=31536000, immutable"
          : "private, max-age=300, must-revalidate",
        "content-length": String(variant.bytes.byteLength),
        "content-type": "image/webp",
        etag: `"${variant.cacheKey}"`,
        "x-image-cache": variant.cacheHit ? "hit" : "miss",
      },
    });
  } catch {
    return errorResponse("Image transformation failed", 422);
  }
}

async function serveOriginal(
  sourcePath: string,
  stats: Stats,
  knownMetadata?: ImageMetadata,
): Promise<Response> {
  try {
    const metadata =
      knownMetadata ??
      (await sharp(sourcePath, {
        failOn: "error",
        limitInputPixels: MAX_INPUT_PIXELS,
        sequentialRead: true,
      }).metadata());
    const bytes = await readFile(sourcePath);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "cache-control": "private, max-age=300",
        "content-length": String(bytes.byteLength),
        "content-type": contentTypeForFormat(metadata.format),
        etag: sourceEtag(stats),
        "last-modified": new Date(stats.mtimeMs).toUTCString(),
        "x-image-cache": "source",
      },
    });
  } catch {
    return errorResponse("Invalid image", 422);
  }
}
