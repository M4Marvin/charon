// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { serveStoredImage } from "@/server/image-optimizer";

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

function optimizerOptions() {
  return { rootDir, cacheDir, maxCacheBytes: 10 * 1024 * 1024, now: () => now };
}

describe("serveStoredImage", () => {
  it("resizes, converts to WebP, and persists a cache variant", async () => {
    const first = await serveStoredImage(
      request("/api/characters/test/avatar?w=512&q=80&v=test.png"),
      storedPath,
      optimizerOptions(),
    );

    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toBe("image/webp");
    expect(first.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
    expect(first.headers.get("x-image-cache")).toBe("miss");
    const transformed = Buffer.from(await first.arrayBuffer());
    expect((await sharp(transformed).metadata()).width).toBe(512);

    const second = await serveStoredImage(
      request("/api/characters/test/avatar?w=512&q=80&v=test.png"),
      storedPath,
      optimizerOptions(),
    );
    expect(second.headers.get("x-image-cache")).toBe("hit");
    expect(Buffer.from(await second.arrayBuffer()).equals(transformed)).toBe(true);
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
  });

  it("does not advertise an unversioned transformed response as immutable", async () => {
    const response = await serveStoredImage(
      request("/api/characters/test/avatar?w=512"),
      storedPath,
      optimizerOptions(),
    );

    expect(response.headers.get("cache-control")).toBe("private, max-age=300, must-revalidate");
  });

  it("deduplicates concurrent transforms of the same variant", async () => {
    const url = "/api/characters/test/avatar?w=384&q=70&v=test.png";
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
    const missing = await serveStoredImage(
      request("/api/characters/test/avatar?w=512"),
      "uploads/avatars/missing.png",
      optimizerOptions(),
    );

    expect(traversal.status).toBe(400);
    expect(missing.status).toBe(404);
  });
});
