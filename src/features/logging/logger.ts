import type { LogLevel, Logger, LogEntry, Transport, Formatter } from "./types";
import { resolveDefaultLevel } from "./level";
import { formatEntry } from "./format";
import { getTransports } from "./transports";

const LEVEL_RANK = { debug: 0, info: 1, warn: 2, error: 3 } as const;

let globalLevel: LogLevel = resolveDefaultLevel();
const transports = getTransports();

export function setGlobalLevel(level: LogLevel): void {
  globalLevel = level;
}

function makeEntry(
  level: LogLevel,
  module: string,
  msg: string,
  data?: Record<string, unknown>,
  error?: Error,
): LogEntry {
  const entry: LogEntry = { level, ts: new Date().toISOString(), module, msg };
  if (data) entry.data = data;
  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    };
  }
  return entry;
}

export function createLoggerCore(deps: {
  transports: Transport[];
  format: Formatter;
  getLevel: () => LogLevel;
  module: string;
}): Logger {
  const { transports, format, getLevel, module } = deps;

  const log =
    (entryLevel: LogLevel) =>
    (msg: string, data?: Record<string, unknown>, error?: Error): void => {
      if (LEVEL_RANK[entryLevel] < LEVEL_RANK[getLevel()]) return;
      const entry = makeEntry(entryLevel, module, msg, data, error);
      for (const t of transports) t.write(entry, format);
    };

  return {
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
  };
}

const instances = new Map<string, Logger>();

export function createLogger(module: string): Logger {
  const existing = instances.get(module);
  if (existing) return existing;

  const logger = createLoggerCore({
    transports,
    format: formatEntry,
    getLevel: () => globalLevel,
    module,
  });

  instances.set(module, logger);
  return logger;
}
