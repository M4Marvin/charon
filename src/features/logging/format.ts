import { createIsomorphicFn } from "@tanstack/react-start";
import type { Formatter, LogEntry } from "./types";

export function formatServer(entry: LogEntry): string {
  return JSON.stringify(entry);
}

export function formatClient(entry: LogEntry): string {
  const time = entry.ts.slice(11, 19);
  const level = entry.level.toUpperCase().padEnd(5);
  const tag = `[${time}] ${level} ${entry.module}`;
  const data = entry.data ? `  ${JSON.stringify(entry.data)}` : "";
  const err = entry.error ? `\n  ${entry.error.stack ?? entry.error.message}` : "";
  return `${tag}  ${entry.msg}${data}${err}`;
}

export const formatEntry: Formatter = createIsomorphicFn()
  .server(formatServer)
  .client(formatClient) as unknown as Formatter;
