import { describe, expect, it } from "vitest";

import { isBlockedDevAssetPath, normalizeDevRequestPath, VITE_FS_DENY } from "./vite-dev-policy";

describe("normalizeDevRequestPath", () => {
  it("decodes and normalizes dot segments", () => {
    expect(normalizeDevRequestPath("/data/../public/data/image.png?raw=1")).toBe(
      "/public/data/image.png",
    );
    expect(normalizeDevRequestPath("/%2e%2e/public/data/image.png")).toBe("/public/data/image.png");
    expect(normalizeDevRequestPath("/%252e%252e/public/data/image.png")).toBe(
      "/public/data/image.png",
    );
  });
});

describe("isBlockedDevAssetPath", () => {
  it.each([
    "/data",
    "/data/uploads/avatars/image.png",
    "/data/.image-cache/hash.webp",
    "/public/data/image.png",
    "/public/uploads/image.png",
    "/uploads/avatars/image.png",
    "/data/../public/data/image.png",
    "/./data/uploads/image.png",
    "/%2e%2e/public/data/image.png",
    "/%252e%252e/data/uploads/image.png",
  ])("blocks private dev URL %s", (path) => {
    expect(isBlockedDevAssetPath(path)).toBe(true);
  });

  it.each([
    "/@fs/home/user/charon/data/uploads/image.png",
    "/@fs/home/user/charon/public/data/image.png",
    "/@fs/home/user/charon/public/uploads/image.png",
    "/@fs/home/user/charon/data/../public/data/image.png",
    "/@fs/%2Fhome%2Fuser%2Fcharon%2Fdata%2Fuploads%2Fimage.png",
  ])("blocks private raw filesystem URL %s", (path) => {
    expect(isBlockedDevAssetPath(path)).toBe(true);
  });

  it.each([
    "/favicon.ico",
    "/logo.svg",
    "/src/main.tsx",
    "/@fs/home/user/charon/src/main.tsx",
    "/@vite/client",
    "/api/characters/123/avatar",
  ])("allows non-private dev URL %s", (path) => {
    expect(isBlockedDevAssetPath(path)).toBe(false);
  });
});

describe("VITE_FS_DENY", () => {
  it("preserves Vite's secret defaults and uses absolute-friendly private patterns", () => {
    expect(VITE_FS_DENY).toEqual(
      expect.arrayContaining([
        ".env",
        ".env.*",
        "*.{crt,pem,key,p12,pfx,cer,der}",
        ".npmrc",
        ".yarnrc.yml",
        "**/.git/**",
        "**/data/**",
        "**/public/data/**",
        "**/public/uploads/**",
      ]),
    );
  });
});
