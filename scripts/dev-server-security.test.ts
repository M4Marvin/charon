// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import { privateAssetDevPlugin, viteFsDeny } from "./vite-dev-policy";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("Vite dev asset policy", () => {
  it("blocks private assets and secrets while serving safe files", async () => {
    const root = await mkdtemp(join(tmpdir(), "charon-vite-policy-"));
    tempDirs.push(root);
    await mkdir(join(root, "data/uploads/avatars"), { recursive: true });
    await mkdir(join(root, "public/data/avatars"), { recursive: true });
    await writeFile(join(root, "data/uploads/avatars/private.png"), "private");
    await writeFile(join(root, "public/data/avatars/legacy.png"), "legacy");
    await mkdir(join(root, "logs"), { recursive: true });
    await writeFile(join(root, ".env"), "SECRET=1");
    await writeFile(join(root, "dev.db"), "database");
    await writeFile(join(root, "logs/app.log"), "log");
    await writeFile(join(root, "safe.txt"), "safe");

    const server = await createServer({
      root,
      configFile: false,
      publicDir: false,
      logLevel: "silent",
      server: {
        port: 0,
        fs: { strict: true, deny: viteFsDeny(root) },
      },
      plugins: [privateAssetDevPlugin()],
    });

    try {
      await server.listen();
      const localUrl = server.resolvedUrls?.local[0];
      if (!localUrl) throw new Error("Vite did not expose a local URL");
      const base = localUrl.replace(/\/$/, "");

      for (const path of [
        "/data/uploads/avatars/private.png",
        "/public/data/avatars/legacy.png",
        "/data/../public/data/avatars/legacy.png",
        "/%2e%2e/public/data/avatars/legacy.png",
        "/.env",
        "/dev.db",
        "/logs/app.log",
        `/@fs${join(root, "data/uploads/avatars/private.png")}`,
        `/@fs${join(root, "dev.db")}`,
      ]) {
        const response = await fetch(`${base}${path}`);
        expect([403, 404], `${path} returned ${response.status}`).toContain(response.status);
      }

      await expect(fetch(`${base}/safe.txt`)).resolves.toMatchObject({ status: 200 });
    } finally {
      await server.close();
    }
  }, 30_000);

  it("does not block safe files when the checkout path contains a data segment", async () => {
    const parent = await mkdtemp(join(tmpdir(), "charon-policy-root-"));
    tempDirs.push(parent);
    const root = join(parent, "data", "app");
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "safe.txt"), "safe");

    const server = await createServer({
      root,
      configFile: false,
      publicDir: false,
      logLevel: "silent",
      server: {
        port: 0,
        fs: { strict: true, deny: viteFsDeny(root) },
      },
      plugins: [privateAssetDevPlugin()],
    });

    try {
      await server.listen();
      const localUrl = server.resolvedUrls?.local[0];
      if (!localUrl) throw new Error("Vite did not expose a local URL");
      const base = localUrl.replace(/\/$/, "");

      await expect(fetch(`${base}/safe.txt`)).resolves.toMatchObject({ status: 200 });
      await expect(fetch(`${base}/@fs${join(root, "safe.txt")}`)).resolves.toMatchObject({
        status: 200,
      });
    } finally {
      await server.close();
    }
  }, 30_000);
});
