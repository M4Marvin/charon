import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { prepareMigrationInput } from "./prepare-migration-input";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "charon-migration-input-"));
  tempDirs.push(dir);
  return dir;
}

describe("prepareMigrationInput", () => {
  it("atomically moves legacy public/data to data/import", async () => {
    const cwd = await makeTempDir();
    await mkdir(join(cwd, "public/data/characters"), { recursive: true });
    await writeFile(join(cwd, "public/data/characters/card.png"), "card");

    await expect(prepareMigrationInput(cwd)).resolves.toBe("moved");
    await expect(readFile(join(cwd, "data/import/characters/card.png"), "utf8")).resolves.toBe(
      "card",
    );
    await expect(prepareMigrationInput(cwd)).resolves.toBe("already-prepared");
  });

  it("creates an empty target when neither directory exists", async () => {
    const cwd = await makeTempDir();
    await expect(prepareMigrationInput(cwd)).resolves.toBe("created");
    await expect(prepareMigrationInput(cwd)).resolves.toBe("already-prepared");
  });

  it("rejects merging when both directories exist", async () => {
    const cwd = await makeTempDir();
    await mkdir(join(cwd, "public/data"), { recursive: true });
    await mkdir(join(cwd, "data/import"), { recursive: true });

    await expect(prepareMigrationInput(cwd)).rejects.toThrow("merge them manually");
  });

  it("rejects symlinked legacy input", async () => {
    const cwd = await makeTempDir();
    const outside = await makeTempDir();
    await mkdir(join(cwd, "public"), { recursive: true });
    await symlink(outside, join(cwd, "public/data"), "dir");

    await expect(prepareMigrationInput(cwd)).rejects.toThrow("must not be symlinks");
  });

  it("rejects a symlinked public parent before moving anything", async () => {
    const cwd = await makeTempDir();
    const outside = await makeTempDir();
    await mkdir(join(outside, "data"), { recursive: true });
    await symlink(outside, join(cwd, "public"), "dir");

    await expect(prepareMigrationInput(cwd)).rejects.toThrow("must not be symlinks");
    await expect(readdir(join(outside, "data"))).resolves.toEqual([]);
  });
});
