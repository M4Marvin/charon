export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  ts: string;
  module: string;
  msg: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  };
}

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>, error?: Error): void;
  info(msg: string, data?: Record<string, unknown>, error?: Error): void;
  warn(msg: string, data?: Record<string, unknown>, error?: Error): void;
  error(msg: string, data?: Record<string, unknown>, error?: Error): void;
}

export type Formatter = (entry: LogEntry) => string;

export interface Transport {
  write(entry: LogEntry, format: Formatter): void;
}
