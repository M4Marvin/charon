import { posix } from "node:path";

/** Preserve Vite's defaults, then add Charon's private filesystem roots. */
export const VITE_FS_DENY = [
  ".env",
  ".env.*",
  "*.{crt,pem,key,p12,pfx,cer,der}",
  ".npmrc",
  ".yarnrc.yml",
  "**/.git/**",
  "**/data/**",
  "**/public/data/**",
  "**/public/uploads/**",
] as const;

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

export function isBlockedDevAssetPath(rawUrl: string): boolean {
  const pathname = normalizeDevRequestPath(rawUrl);
  if (isDirectPrivatePath(pathname)) return true;

  if (!pathname.startsWith("/@fs/")) return false;
  const fsPath = pathname.slice("/@fs/".length);
  return /(^|\/)(?:data|public\/(?:data|uploads))(?:\/|$)/.test(fsPath);
}
