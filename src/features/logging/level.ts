import { createIsomorphicFn } from "@tanstack/react-start";
import type { LogLevel } from "./types";

const VALID = new Set<LogLevel>(["debug", "info", "warn", "error"]);

export function parseLevel(raw: string | null | undefined): LogLevel | null {
  if (raw && VALID.has(raw as LogLevel)) return raw as LogLevel;
  return null;
}

export function resolveServerLevel(): LogLevel {
  const env = parseLevel(process.env.LOG_LEVEL);
  if (env) return env;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

export function resolveClientLevel(): LogLevel {
  try {
    const stored = parseLevel(localStorage.getItem("LOG_LEVEL"));
    if (stored) return stored;
  } catch {
    // localStorage unavailable
  }
  return import.meta.env.DEV ? "debug" : "info";
}

export const resolveDefaultLevel: () => LogLevel = createIsomorphicFn()
  .server(resolveServerLevel)
  .client(resolveClientLevel) as unknown as () => LogLevel;
