// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { invalidateStoredImageCache, serveStoredImage } from "@/server/image-optimizer";

let testDir: string;
let rootDir: string;
let cacheDir: string;
let storedPath: string;
let sourcePath: string;

const now = new Date("2026-09-23T20:00:00.000Z");

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "charon-image-optimizer-"));
  rootDir = join(testDir, "data");
  cacheDir = join(rootDir, ".image-cache");
  storedPath = "uploads/avatars/test-image.png";
  sourcePath = join(rootDir, storedPath);
  await mkdir(dirname(sourcePath), { recursive: true });
  await writeFile(
    sourcePath,
    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 40, g: 100, b: 180 },
      },
    })
      .png()
      .toBuffer(),
  );
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

function request(url: string): Request {
  return new Request(`http://localhost${url}`);
}

async function listWebpCacheFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listWebpCacheFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith(".webp")) {
      files.push(path);
    }
  }
  return files;
}

async function findWebpCache(root: string): Promise<string> {
  const files = await listWebpCacheFiles(root);
  if (files[0]) return files[0];
  throw new Error("WebP cache file not found");
}

function optimizerOptions() {
  return { rootDir, cacheDir, maxCacheBytes: 10 * 1024 * 1024, now: () => now };
}

describe("serveStoredImage", () => {
  it("resizes, converts to WebP, and persists a cache variant", async () => {
    const first = await serveStoredImage(
      request("/api/characters/test/avatar?w=512&q=80&v=test-image.png"),
      storedPath,
      optimizerOptions(),
    );

    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toBe("image/webp");
    expect(first.headers.get("cache-control")).toBe("private, max-age=300, must-revalidate");
    expect(first.headers.get("x-image-cache")).toBe("miss");
    const transformed = Buffer.from(await first.arrayBuffer());
    expect((await sharp(transformed).metadata()).width).toBe(512);

    const second = await serveStoredImage(
      request("/api/characters/test/avatar?w=512&q=80&v=test-image.png"),
      storedPath,
      optimizerOptions(),
    );
    expect(second.headers.get("x-image-cache")).toBe("hit");
    expect(Buffer.from(await second.arrayBuffer()).equals(transformed)).toBe(true);
  });

  it("does not reuse a cached variant after a same-path source replacement", async () => {
    const first = await serveStoredImage(
      request("/api/characters/test/avatar?w=512"),
      storedPath,
      optimizerOptions(),
    );
    const firstBytes = Buffer.from(await first.arrayBuffer());
    expect(first.headers.get("x-image-cache")).toBe("miss");

    await writeFile(
      sourcePath,
      await sharp({
        create: {
          width: 1200,
          height: 800,
          channels: 3,
          background: { r: 220, g: 40, b: 40 },
        },
      })
        .png()
        .toBuffer(),
    );

    const second = await serveStoredImage(
      request("/api/characters/test/avatar?w=512"),
      storedPath,
      optimizerOptions(),
    );
    const secondBytes = Buffer.from(await second.arrayBuffer());

    expect(second.headers.get("x-image-cache")).toBe("miss");
    expect(secondBytes.equals(firstBytes)).toBe(false);
  });

  it("uses the oriented width when selecting a transform", async () => {
    await writeFile(
      sourcePath,
      await sharp({
        create: {
          width: 800,
          height: 1200,
          channels: 3,
          background: { r: 40, g: 100, b: 180 },
        },
      })
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer(),
    );

    const response = await serveStoredImage(
      request("/api/characters/test/avatar?w=960"),
      storedPath,
      optimizerOptions(),
    );
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();

    expect(metadata.width).toBe(960);
    expect(metadata.height).toBe(640);
  });

  it("shares one cached variant for widths larger than the source", async () => {
    await writeFile(
      sourcePath,
      await sharp({
        create: { width: 800, height: 600, channels: 3, background: { r: 40, g: 100, b: 180 } },
      })
        .png()
        .toBuffer(),
    );

    for (const width of [1024, 1280, 1920, 2560]) {
      const response = await serveStoredImage(
        request(`/api/characters/test/avatar?w=${width}`),
        storedPath,
        optimizerOptions(),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/webp");
      await response.arrayBuffer();
    }

    expect(await listWebpCacheFiles(cacheDir)).toHaveLength(1);
  });

  it("removes all cached variants when a source is invalidated", async () => {
    for (const width of [512, 640]) {
      await serveStoredImage(
        request(`/api/characters/test/avatar?w=${width}`),
        storedPath,
        optimizerOptions(),
      );
    }
    expect(await listWebpCacheFiles(cacheDir)).toHaveLength(2);

    await invalidateStoredImageCache(storedPath, { rootDir, cacheDir });
    expect(await listWebpCacheFiles(cacheDir)).toHaveLength(0);
  });

  it("returns 304 for a matching transformed validator", async () => {
    const url = "/api/characters/test/avatar?w=512&q=80&v=test-image.png";
    const first = await serveStoredImage(request(url), storedPath, optimizerOptions());
    const revalidated = await serveStoredImage(
      new Request(`http://localhost${url}`, {
        headers: { "if-none-match": first.headers.get("etag") ?? "" },
      }),
      storedPath,
      optimizerOptions(),
    );

    expect(revalidated.status).toBe(304);
    expect((await revalidated.arrayBuffer()).byteLength).toBe(0);
  });

  it("serves transformed bytes when the cache cannot be written", async () => {
    await writeFile(cacheDir, "not a directory");

    const response = await serveStoredImage(
      request("/api/characters/test/avatar?w=512"),
      storedPath,
      optimizerOptions(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
  });

  it("regenerates a corrupt cache entry", async () => {
    const url = "/api/characters/test/avatar?w=512&q=80&v=test-image.png";
    const first = await serveStoredImage(request(url), storedPath, optimizerOptions());
    const cacheFile = await findWebpCache(cacheDir);
    await writeFile(cacheFile, "corrupt");

    const second = await serveStoredImage(request(url), storedPath, optimizerOptions());
    const secondBytes = Buffer.from(await second.arrayBuffer());
    expect(second.status).toBe(200);
    expect(second.headers.get("x-image-cache")).toBe("miss");
    expect((await sharp(secondBytes).metadata()).format).toBe("webp");
    expect(secondBytes.equals(Buffer.from(await first.arrayBuffer()))).toBe(true);
  });

  it("serves AVIF with the correct MIME type and optimizes it when requested", async () => {
    const pixels = Buffer.alloc(1200 * 800 * 3);
    let seed = 0x12345678;
    for (let i = 0; i < pixels.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      pixels[i] = seed & 0xff;
    }
    await writeFile(
      sourcePath,
      await sharp(pixels, { raw: { width: 1200, height: 800, channels: 3 } })
        .avif()
        .toBuffer(),
    );

    const original = await serveStoredImage(
      request("/api/characters/test/avatar"),
      storedPath,
      optimizerOptions(),
    );
    expect(original.status).toBe(200);
    expect(original.headers.get("content-type")).toBe("image/avif");

    const transformed = await serveStoredImage(
      request("/api/characters/test/avatar?w=512"),
      storedPath,
      optimizerOptions(),
    );
    expect(transformed.status).toBe(200);
    expect(transformed.headers.get("content-type")).toBe("image/webp");
    expect((await sharp(await transformed.arrayBuffer()).metadata()).width).toBe(512);
  });

  it("rejects active SVG sources", async () => {
    await writeFile(
      sourcePath,
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><script>alert(1)</script></svg>',
    );

    const original = await serveStoredImage(
      request("/api/characters/test/avatar"),
      storedPath,
      optimizerOptions(),
    );
    const transformed = await serveStoredImage(
      request("/api/characters/test/avatar?w=512"),
      storedPath,
      optimizerOptions(),
    );

    expect(original.status).toBe(415);
    expect(transformed.status).toBe(415);
  });

  it("serves the correctly detected source format without transformation parameters", async () => {
    const response = await serveStoredImage(
      request("/api/characters/test/avatar"),
      storedPath,
      optimizerOptions(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-image-cache")).toBe("source");
    expect((await sharp(await response.arrayBuffer()).metadata()).format).toBe("png");

    const revalidated = await serveStoredImage(
      new Request("http://localhost/api/characters/test/avatar", {
        headers: { "if-none-match": response.headers.get("etag") ?? "" },
      }),
      storedPath,
      optimizerOptions(),
    );
    expect(revalidated.status).toBe(304);
  });

  it("uses revalidation for versioned image responses", async () => {
    const transformed = await serveStoredImage(
      request("/api/characters/test/avatar?w=512&v=test-image.png"),
      storedPath,
      optimizerOptions(),
    );
    const original = await serveStoredImage(
      request("/api/characters/test/avatar?v=test-image.png"),
      storedPath,
      optimizerOptions(),
    );

    expect(transformed.headers.get("cache-control")).toBe("private, max-age=300, must-revalidate");
    expect(original.headers.get("cache-control")).toBe("private, max-age=300, must-revalidate");
  });

  it("deduplicates concurrent transforms of the same variant", async () => {
    const url = "/api/characters/test/avatar?w=384&q=70&v=test-image.png";
    const [first, second] = await Promise.all([
      serveStoredImage(request(url), storedPath, optimizerOptions()),
      serveStoredImage(request(url), storedPath, optimizerOptions()),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(
      [first.headers.get("x-image-cache"), second.headers.get("x-image-cache")].sort(),
    ).toEqual(["hit", "miss"]);
  });

  it("rejects widths and qualities outside the bounded transformation matrix", async () => {
    const invalidWidth = await serveStoredImage(
      request("/api/characters/test/avatar?w=333"),
      storedPath,
      optimizerOptions(),
    );
    const invalidQuality = await serveStoredImage(
      request("/api/characters/test/avatar?w=512&q=73"),
      storedPath,
      optimizerOptions(),
    );

    expect(invalidWidth.status).toBe(400);
    expect(invalidQuality.status).toBe(400);
  });

  it("rejects traversal and returns a missing-file response", async () => {
    const traversal = await serveStoredImage(
      request("/api/characters/test/avatar?w=512"),
      "../outside.png",
      optimizerOptions(),
    );
    const siblingFile = await serveStoredImage(
      request("/api/characters/test/avatar?w=512"),
      "uploads/../local.db",
      optimizerOptions(),
    );
    const missing = await serveStoredImage(
      request("/api/characters/test/avatar?w=512"),
      "uploads/avatars/missing.png",
      optimizerOptions(),
    );

    expect(traversal.status).toBe(400);
    expect(siblingFile.status).toBe(400);
    expect(missing.status).toBe(404);
  });
});
