import { mkdtemp, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { MAX_IMAGE_BYTES } from "@/server/image-limits";
import { readMigrationFile } from "./migration-io";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("readMigrationFile", () => {
  it("reads a file within the migration limit", async () => {
    const dir = await mkdtemp(join(tmpdir(), "charon-migration-"));
    tempDirs.push(dir);
    const path = join(dir, "small.bin");
    await writeFile(path, Buffer.from("migration input"));

    await expect(readMigrationFile(path)).resolves.toEqual(Buffer.from("migration input"));
  });

  it("rejects oversized files before allocating their contents", async () => {
    const dir = await mkdtemp(join(tmpdir(), "charon-migration-"));
    tempDirs.push(dir);
    const path = join(dir, "oversized.bin");
    await writeFile(path, Buffer.alloc(0));
    await truncate(path, MAX_IMAGE_BYTES + 1);

    await expect(readMigrationFile(path)).rejects.toThrow(
      "Private file exceeds the allowed size limit",
    );
  });
});
