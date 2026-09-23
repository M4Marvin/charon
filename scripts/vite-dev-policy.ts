import { posix, resolve } from "node:path";

import type { Plugin } from "vite";

export const VITE_DEFAULT_FS_DENY = [
  ".env",
  ".env.*",
  "*.{crt,pem,key,p12,pfx,cer,der}",
  ".npmrc",
  ".yarnrc.yml",
  "**/.git/**",
] as const;

function absolutePattern(root: string, relativePath: string): string {
  return resolve(root, relativePath).replaceAll("\\", "/");
}

export function viteFsDeny(root: string): string[] {
  return [
    ...VITE_DEFAULT_FS_DENY,
    `${absolutePattern(root, "data")}/**`,
    `${absolutePattern(root, "public/data")}/**`,
    `${absolutePattern(root, "public/uploads")}/**`,
    `${absolutePattern(root, "uploads")}/**`,
    absolutePattern(root, "dev.db"),
    `${absolutePattern(root, "dev.db")}-*`,
    `${absolutePattern(root, "dev.db")}.bak-*`,
    `${absolutePattern(root, "logs")}/**`,
  ];
}

function decodeRepeatedly(rawPath: string): string {
  let pathname = rawPath;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const decoded = decodeURIComponent(pathname);
      if (decoded === pathname) break;
      pathname = decoded;
    } catch {
      break;
    }
  }
  return pathname;
}

export function normalizeDevRequestPath(rawUrl: string): string {
  const rawPath = rawUrl.split(/[?#]/, 1)[0] ?? "";
  const decoded = decodeRepeatedly(rawPath);
  return posix.normalize(`/${decoded.replace(/^\/+/, "")}`);
}

function isDirectPrivatePath(pathname: string): boolean {
  return (
    pathname === "/data" ||
    pathname.startsWith("/data/") ||
    pathname === "/public/data" ||
    pathname.startsWith("/public/data/") ||
    pathname === "/public/uploads" ||
    pathname.startsWith("/public/uploads/") ||
    pathname === "/uploads" ||
    pathname.startsWith("/uploads/")
  );
}

function isPrivateFsPath(fsPath: string, projectRoot: string): boolean {
  const root = resolve(projectRoot).replaceAll("\\", "/");
  const privateRoots = [
    `${root}/data`,
    `${root}/public/data`,
    `${root}/public/uploads`,
    `${root}/uploads`,
  ];
  return privateRoots.some(
    (privateRoot) => fsPath === privateRoot || fsPath.startsWith(`${privateRoot}/`),
  );
}

export function isBlockedDevAssetPath(rawUrl: string, projectRoot = process.cwd()): boolean {
  const pathname = normalizeDevRequestPath(rawUrl);
  if (isDirectPrivatePath(pathname)) return true;

  if (!pathname.startsWith("/@fs/")) return false;
  const rawFsPath = pathname.slice("/@fs/".length);
  const fsPath = rawFsPath.startsWith("/") ? rawFsPath : `/${rawFsPath}`;
  return isPrivateFsPath(fsPath, projectRoot);
}

export function privateAssetDevPlugin(): Plugin {
  return {
    name: "charon-private-dev-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        if (isBlockedDevAssetPath(url, server.config.root)) {
          res.statusCode = 404;
          res.end();
          return;
        }

        const dest = req.headers["sec-fetch-dest"];
        if (dest === "image" && (url.startsWith("/api/") || url.startsWith("/uploads/"))) {
          req.headers["sec-fetch-dest"] = "empty";
        }
        next();
      });
    },
  };
}
