import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createLoggerCore, setGlobalLevel } from "./logger";
import { formatServer, formatClient } from "./format";
import { parseLevel, resolveServerLevel } from "./level";
import { consoleTransport, createFileTransport } from "./transports";
import type { LogEntry, LogLevel, Transport } from "./types";

function makeCapture(): { transport: Transport; entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  const transport: Transport = { write: (e) => entries.push(e) };
  return { transport, entries };
}

function makeLogger(level: LogLevel) {
  const cap = makeCapture();
  const log = createLoggerCore({
    transports: [cap.transport],
    format: (e) => JSON.stringify(e),
    getLevel: () => level,
    module: "test",
  });
  return { log, entries: cap.entries };
}

describe("createLoggerCore", () => {
  it("logs at the appropriate level", () => {
    const { log, entries } = makeLogger("debug");
    log.info("hello", { a: 1 });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe("info");
    expect(entries[0]!.msg).toBe("hello");
    expect(entries[0]!.data).toEqual({ a: 1 });
    expect(entries[0]!.module).toBe("test");
    expect(entries[0]!.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("suppresses levels below threshold", () => {
    const { log, entries } = makeLogger("warn");
    log.debug("hidden");
    log.info("hidden");
    log.warn("shown");
    log.error("shown");
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.level)).toEqual(["warn", "error"]);
  });

  it("passes entry to all transports", () => {
    const cap1 = makeCapture();
    const cap2 = makeCapture();
    const log = createLoggerCore({
      transports: [cap1.transport, cap2.transport],
      format: (e) => JSON.stringify(e),
      getLevel: () => "debug",
      module: "test",
    });
    log.info("broadcast");
    expect(cap1.entries).toHaveLength(1);
    expect(cap2.entries).toHaveLength(1);
  });

  it("serializes Error objects with stack", () => {
    const { log, entries } = makeLogger("debug");
    const err = new Error("boom");
    err.name = "CustomError";
    log.error("failed", { chatId: "abc" }, err);
    expect(entries[0]!.error).toBeDefined();
    expect(entries[0]!.error!.name).toBe("CustomError");
    expect(entries[0]!.error!.message).toBe("boom");
    expect(entries[0]!.error!.stack).toContain("boom");
  });

  it("includes error cause when present", () => {
    const { log, entries } = makeLogger("debug");
    const root = new Error("root");
    const wrapped = new Error("wrapped", { cause: root });
    log.error("err", undefined, wrapped);
    expect(entries[0]!.error!.cause).toBe(root);
  });

  it("omits data field when not provided", () => {
    const { log, entries } = makeLogger("debug");
    log.info("plain");
    expect(entries[0]!.data).toBeUndefined();
  });

  it("omits error field when not provided", () => {
    const { log, entries } = makeLogger("debug");
    log.info("plain");
    expect(entries[0]!.error).toBeUndefined();
  });

  it("reads level dynamically via getLevel", () => {
    let level: LogLevel = "debug";
    const cap = makeCapture();
    const log = createLoggerCore({
      transports: [cap.transport],
      format: (e) => JSON.stringify(e),
      getLevel: () => level,
      module: "test",
    });
    log.debug("first");
    level = "error";
    log.info("filtered");
    log.error("second");
    expect(cap.entries.map((e) => e.msg)).toEqual(["first", "second"]);
  });
});

describe("formatServer", () => {
  it("produces valid single-line JSON", () => {
    const entry: LogEntry = {
      level: "info",
      ts: "2026-07-17T10:30:00.000Z",
      module: "chat:tree",
      msg: "ok",
    };
    const out = formatServer(entry);
    expect(out).not.toContain("\n");
    const parsed = JSON.parse(out);
    expect(parsed.msg).toBe("ok");
    expect(parsed.module).toBe("chat:tree");
  });
});

describe("formatClient", () => {
  it("produces human-readable line with time, level, module", () => {
    const entry: LogEntry = {
      level: "info",
      ts: "2026-07-17T10:30:00.000Z",
      module: "chat:ui",
      msg: "clicked",
    };
    const out = formatClient(entry);
    expect(out).toContain("10:30:00");
    expect(out).toContain("INFO");
    expect(out).toContain("chat:ui");
    expect(out).toContain("clicked");
  });

  it("includes data JSON when present", () => {
    const entry: LogEntry = {
      level: "info",
      ts: "2026-07-17T10:30:00.000Z",
      module: "m",
      msg: "x",
      data: { a: 1 },
    };
    expect(formatClient(entry)).toContain('{"a":1}');
  });

  it("includes error stack on a new line when present", () => {
    const entry: LogEntry = {
      level: "error",
      ts: "2026-07-17T10:30:00.000Z",
      module: "m",
      msg: "boom",
      error: { name: "E", message: "m", stack: "at foo\nat bar" },
    };
    const out = formatClient(entry);
    expect(out).toContain("\n  at foo");
  });
});

describe("parseLevel", () => {
  it("accepts valid levels", () => {
    expect(parseLevel("debug")).toBe("debug");
    expect(parseLevel("info")).toBe("info");
    expect(parseLevel("warn")).toBe("warn");
    expect(parseLevel("error")).toBe("error");
  });
  it("rejects invalid", () => {
    expect(parseLevel("trace")).toBeNull();
    expect(parseLevel("")).toBeNull();
    expect(parseLevel(null)).toBeNull();
    expect(parseLevel(undefined)).toBeNull();
  });
});

describe("resolveServerLevel", () => {
  const origLevel = process.env.LOG_LEVEL;
  const origNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (origLevel === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = origLevel;
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
  });

  it("uses LOG_LEVEL when set", () => {
    process.env.LOG_LEVEL = "warn";
    expect(resolveServerLevel()).toBe("warn");
  });
  it("falls back to debug when not production", () => {
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = "development";
    expect(resolveServerLevel()).toBe("debug");
  });
  it("falls back to info in production", () => {
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = "production";
    expect(resolveServerLevel()).toBe("info");
  });
  it("ignores invalid LOG_LEVEL", () => {
    process.env.LOG_LEVEL = "trace";
    delete process.env.NODE_ENV;
    expect(resolveServerLevel()).toBe("debug");
  });
});

describe("createFileTransport", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "log-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the directory if it does not exist", () => {
    const nested = path.join(tmpDir, "nested", "logs");
    createFileTransport(nested, fs, path);
    expect(fs.existsSync(nested)).toBe(true);
  });

  it("writes JSON line to app-YYYY-MM-DD.log", () => {
    const transport = createFileTransport(tmpDir, fs, path);
    const entry: LogEntry = {
      level: "info",
      ts: "2026-07-17T10:30:00.000Z",
      module: "test",
      msg: "hello",
    };
    transport.write(entry, (e) => JSON.stringify(e));
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const expected = path.join(
      tmpDir,
      `app-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.log`,
    );
    expect(fs.existsSync(expected)).toBe(true);
    const content = fs.readFileSync(expected, "utf-8");
    const lines = content.split("\n").filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.msg).toBe("hello");
    expect(parsed.module).toBe("test");
  });

  it("appends multiple lines to the same file", () => {
    const transport = createFileTransport(tmpDir, fs, path);
    const entry: LogEntry = {
      level: "info",
      ts: "2026-07-17T10:30:00.000Z",
      module: "test",
      msg: "x",
    };
    transport.write(entry, (e) => JSON.stringify(e));
    transport.write(entry, (e) => JSON.stringify(e));
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const expected = path.join(
      tmpDir,
      `app-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.log`,
    );
    const content = fs.readFileSync(expected, "utf-8");
    expect(content.split("\n").filter(Boolean)).toHaveLength(2);
  });
});

describe("consoleTransport", () => {
  it("routes to console.log / warn / error by level", () => {
    const errors: string[] = [];
    const warns: string[] = [];
    const logs: string[] = [];
    const orig = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };
    console.log = (...args: unknown[]) => logs.push(String(args[0]));
    console.warn = (...args: unknown[]) => warns.push(String(args[0]));
    console.error = (...args: unknown[]) => errors.push(String(args[0]));
    try {
      const mkEntry = (level: LogLevel): LogEntry => ({
        level,
        ts: "2026-07-17T10:30:00.000Z",
        module: "t",
        msg: "m",
      });
      consoleTransport.write(mkEntry("info"), (e) => JSON.stringify(e));
      consoleTransport.write(mkEntry("debug"), (e) => JSON.stringify(e));
      consoleTransport.write(mkEntry("warn"), (e) => JSON.stringify(e));
      consoleTransport.write(mkEntry("error"), (e) => JSON.stringify(e));
      expect(logs).toHaveLength(2);
      expect(warns).toHaveLength(1);
      expect(errors).toHaveLength(1);
    } finally {
      console.log = orig.log;
      console.warn = orig.warn;
      console.error = orig.error;
    }
  });
});

describe("setGlobalLevel", () => {
  it("does not throw", () => {
    setGlobalLevel("debug");
    setGlobalLevel("error");
  });
});
