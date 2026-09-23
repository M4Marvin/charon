// @vitest-environment node
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { MAX_IMAGE_BYTES } from "@/server/image-limits";
import {
  readPrivateDirectory,
  readPrivateFile,
  resolveStoredUploadPath,
  writePrivateFileAtomic,
} from "@/server/private-fs";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "charon-private-fs-"));
  tempDirs.push(dir);
  return dir;
}

describe("resolveStoredUploadPath", () => {
  it("rejects symlinked upload directories and files", async () => {
    const root = await makeTempDir();
    const outside = await makeTempDir();
    await mkdir(join(root, "uploads"), { recursive: true });
    await writeFile(join(outside, "image.png"), "outside");
    await symlink(outside, join(root, "uploads", "avatars"), "dir");

    expect(resolveStoredUploadPath(root, "uploads/avatars/image.png")).toBeNull();

    await rm(join(root, "uploads", "avatars"));
    await mkdir(join(root, "uploads", "avatars"), { recursive: true });
    await symlink(
      join(outside, "image.png"),
      join(root, "uploads", "avatars", "image.png"),
      "file",
    );
    expect(resolveStoredUploadPath(root, "uploads/avatars/image.png")).toBeNull();
  });
});

describe("private file I/O", () => {
  it("writes atomically without leaving temporary files", async () => {
    const root = await makeTempDir();
    const path = join(root, "image.png");

    await writePrivateFileAtomic(path, Buffer.from("image"));

    await expect(readFile(path, "utf8")).resolves.toBe("image");
    await expect(readdir(root)).resolves.toEqual(["image.png"]);
  });

  it("enforces cache roots and cleans up an uncommitted atomic write", async () => {
    const root = await makeTempDir();
    const cacheDir = join(root, "cache");
    const path = join(cacheDir, "nested", "image.webp");
    const outside = await makeTempDir();
    await mkdir(join(cacheDir, "nested"), { recursive: true });
    await symlink(outside, join(cacheDir, "escape"), "dir");

    await expect(
      writePrivateFileAtomic(path, Buffer.from("image"), {
        rootDir: root,
        beforeCommit: () => false,
      }),
    ).resolves.toBe(false);
    await expect(readdir(join(cacheDir, "nested"))).resolves.toEqual([]);
    await expect(readPrivateDirectory(join(cacheDir, "escape"), root)).rejects.toThrow(
      "Private path",
    );
    await expect(
      writePrivateFileAtomic(join(cacheDir, "escape", "outside.webp"), Buffer.from("no"), {
        rootDir: root,
      }),
    ).rejects.toThrow("Private path escapes");
  });

  it("rejects oversized reads before allocating their contents", async () => {
    const root = await makeTempDir();
    const path = join(root, "oversized.bin");
    await writeFile(path, Buffer.alloc(0));
    await truncate(path, MAX_IMAGE_BYTES + 1);

    await expect(readPrivateFile(path)).rejects.toThrow(
      "Private file exceeds the allowed size limit",
    );
  });
});
