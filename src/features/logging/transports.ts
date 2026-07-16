import { createIsomorphicFn } from "@tanstack/react-start";
import type { Formatter, LogEntry, Transport } from "./types";

export const consoleTransport: Transport = {
  write(entry: LogEntry, format: Formatter) {
    const line = format(entry);
    switch (entry.level) {
      case "error":
        console.error(line);
        break;
      case "warn":
        console.warn(line);
        break;
      default:
        console.log(line);
        break;
    }
  },
};

export function createFileTransport(
  logDir: string,
  fs: typeof import("node:fs"),
  path: typeof import("node:path"),
): Transport {
  fs.mkdirSync(logDir, { recursive: true });

  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    write(entry: LogEntry, format: Formatter) {
      const d = new Date();
      const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const filename = path.join(logDir, `app-${date}.log`);
      fs.appendFileSync(filename, format(entry) + "\n", "utf-8");
    },
  };
}

export function resolveServerTransports(
  fs: typeof import("node:fs"),
  path: typeof import("node:path"),
): Transport[] {
  if (process.env.LOG_FILE_ENABLED === "false") return [consoleTransport];
  const logDir = process.env.LOG_DIR || "./logs";
  return [consoleTransport, createFileTransport(logDir, fs, path)];
}

export const getTransports: () => Transport[] = createIsomorphicFn()
  .server((): Transport[] => {
    // require() is available in Node.js CJS and vitest, but not in the Vite
    // ESM module runner used by `pnpm run dev`. Catch the ReferenceError and
    // fall back to console-only in dev. File logging works in production (srvx)
    // and tests where the runtime provides require().
    try {
      const fs = require("node:fs") as typeof import("node:fs");
      const path = require("node:path") as typeof import("node:path");
      return resolveServerTransports(fs, path);
    } catch {
      return [consoleTransport];
    }
  })
  .client((): Transport[] => [consoleTransport]) as unknown as () => Transport[];
