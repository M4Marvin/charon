#!/usr/bin/env node
/**
 * Charon launcher and CLI.
 *
 * This file is intentionally dependency-free: it is the first thing a new
 * install runs, so it must work on a plain Node runtime with no pnpm install.
 *
 * Layout (installed):
 *   ~/.charon/app/            <- .output, drizzle, bin
 *   ~/.charon/data/           <- charon.db, uploads, logs, instance.json
 *   ~/.charon/bin/charon      <- shim exported on PATH
 *
 * Layout (Docker):
 *   /app/.output, /app/drizzle, /app/bin
 *   /app/data
 *
 * Configuration is owned by this wrapper, not by the app. The app keeps
 * reading the same env vars it always did (DATABASE_URL, BETTER_AUTH_SECRET,
 * ENCRYPTION_KEY, APP_URL), so nothing in src/ needs to know about the CLI.
 */
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { request } from "node:http";
import { homedir, platform, arch } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, "..");
const VERSION = "0.1.3";
const REPO = "M4Marvin/charon";

function env(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

const HOME = env("CHARON_HOME", APP_ROOT);
const DATA_DIR = env("CHARON_DATA_DIR", join(HOME, "data"));
const LOG_DIR = join(DATA_DIR, "logs");
const PID_FILE = join(DATA_DIR, "charon.pid");
const SERVER_ENTRY = join(APP_ROOT, ".output", "server", "index.mjs");
const INSTANCE_FILE = join(DATA_DIR, "instance.json");
const INSTALL_FILE = join(HOME, "install.json");
const PORT = Number(env("PORT", "3000"));
const HOST = env("CHARON_HOST", "127.0.0.1");
// Keep the browser origin and APP_URL identical. better-auth rejects cookie
// POSTs from a different origin, and localhost/127.0.0.1 are different origins.
const LOCAL_URL = `http://localhost:${PORT}`;

try {
  // Chats and uploads are private; keep new files owner-only on POSIX.
  process.umask(0o077);
} catch {
  // Windows does not implement POSIX modes.
}

function log(message) {
  process.stderr.write(`[charon] ${message}\n`);
}

function fail(message, code = 1) {
  log(message);
  process.exit(code);
}

function ensureDirs() {
  for (const dir of [DATA_DIR, LOG_DIR, join(DATA_DIR, "uploads")]) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    try {
      chmodSync(dir, 0o700);
    } catch {
      // Best effort on Windows and network filesystems.
    }
  }
}

/** Read or create the instance secrets once, then reuse them forever. */
function loadInstance() {
  ensureDirs();
  if (existsSync(INSTANCE_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(INSTANCE_FILE, "utf8"));
      if (parsed.secret && parsed.encryptionKey) return parsed;
      fail(
        `${INSTANCE_FILE} exists but is missing its secrets. Refusing to generate new ones: that would invalidate every session and make stored provider keys unreadable. Restore the file from a backup.`,
      );
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(INSTANCE_FILE)) throw error;
      fail(
        `${INSTANCE_FILE} is unreadable. Refusing to generate new secrets: restore it from a backup. (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }
  const instance = {
    secret: randomBytes(32).toString("hex"),
    encryptionKey: randomBytes(32).toString("hex"),
    createdAt: new Date().toISOString(),
  };
  writeFileSync(INSTANCE_FILE, JSON.stringify(instance, null, 2) + "\n", { mode: 0o600 });
  try {
    chmodSync(INSTANCE_FILE, 0o600);
  } catch {
    // Best effort on filesystems without POSIX modes.
  }
  return instance;
}

function applyEnv(instance) {
  process.env.NODE_ENV = process.env.NODE_ENV || "production";
  process.env.DATABASE_URL = env("DATABASE_URL", join(DATA_DIR, "charon.db"));
  process.env.BETTER_AUTH_SECRET = env("BETTER_AUTH_SECRET", instance.secret);
  process.env.ENCRYPTION_KEY = env("ENCRYPTION_KEY", instance.encryptionKey);
  process.env.APP_URL = env("APP_URL", LOCAL_URL);
  process.env.CHARON_DATA_DIR = DATA_DIR;
  process.env.LOG_DIR = env("LOG_DIR", join(DATA_DIR, "logs"));
  process.env.PORT = String(PORT);
  process.env.CHARON_HOST = HOST;
  // Nitro reads HOST for listen address.
  process.env.HOST = env("HOST", HOST);
  process.chdir(APP_ROOT);
}

function checkNode() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  // better-sqlite3 13 is built against N-API 10, which Node 22.14+ provides.
  if (Number.isNaN(major) || major < 22 || (major === 22 && minor < 14)) {
    fail(`Charon needs Node.js 22.14 or newer; this is ${process.version}. Re-run the installer or install Node from https://nodejs.org`);
  }
}

function readPid() {
  try {
    const pid = Number(readFileSync(PID_FILE, "utf8").trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * A stale pid file must never kill an unrelated process. On POSIX, check the
 * command line. On Windows the health probe is the identity check, because
 * tasklist does not expose the script arguments.
 */
function processLooksLikeCharon(pid) {
  if (platform() === "win32") return true;
  try {
    const command = execFileSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
    }).trim();
    return /charon/i.test(command);
  } catch {
    return false;
  }
}

function probeHealth(timeoutMs = 1500) {
  return new Promise((resolvePromise) => {
    const req = request(
      { host: "127.0.0.1", port: PORT, path: "/up", method: "GET", timeout: timeoutMs },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            resolvePromise({
              ok: res.statusCode === 200 && parsed?.status === "ok",
              status: res.statusCode,
              body: parsed,
            });
          } catch {
            // Another service can answer 200 on the same port; only Charon's
            // own /up payload counts as healthy.
            resolvePromise({ ok: false, status: res.statusCode, body: null });
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (error) => resolvePromise({ ok: false, status: 0, error: error.message }));
    req.end();
  });
}

async function waitForHealth(seconds = 45) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const health = await probeHealth();
    if (health.ok) return health;
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

function serverEntry() {
  if (!existsSync(SERVER_ENTRY)) {
    fail(`Server bundle not found at ${SERVER_ENTRY}. Reinstall Charon or run it from a release tarball.`);
  }
  return SERVER_ENTRY;
}

async function serve() {
  checkNode();
  const instance = loadInstance();
  applyEnv(instance);
  ensureDirs();
  if (!existsSync(join(APP_ROOT, "drizzle"))) {
    fail(`Migrations folder not found at ${join(APP_ROOT, "drizzle")}. Reinstall Charon.`);
  }
  await import(pathToFileURL(serverEntry()).href);
}

function openBrowser(url) {
  const command =
    platform() === "darwin" ? ["open", [url]] :
    platform() === "win32" ? ["cmd", ["/c", "start", "", url]] :
    ["xdg-open", [url]];
  const child = spawn(command[0], command[1], { detached: true, stdio: "ignore" });
  child.on("error", () => log(`Open ${url} in your browser.`));
  child.unref();
}

function spawnServer({ detach }) {
  const logFile = join(LOG_DIR, "charon.log");
  const fd = openSync(logFile, "a");
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "serve"], {
    cwd: APP_ROOT,
    env: { ...process.env, CHARON_HOME: HOME, CHARON_DATA_DIR: DATA_DIR },
    detached: detach,
    stdio: detach ? ["ignore", fd, fd] : "inherit",
  });
  if (detach) {
    child.unref();
    writeFileSync(PID_FILE, String(child.pid));
  }
  closeSync(fd);
  return child;
}

async function start({ open = true } = {}) {
  const existing = readPid();
  if (isAlive(existing)) {
    const health = await probeHealth();
    if (health.ok) {
      log(`Charon is already running at ${LOCAL_URL}`);
      if (open) openBrowser(LOCAL_URL);
      return;
    }
  }
  const healthAlready = await probeHealth();
  if (healthAlready.ok) {
    log(`Something is already serving Charon at ${LOCAL_URL}`);
    if (open) openBrowser(LOCAL_URL);
    return;
  }
  ensureDirs();
  log(`Starting Charon from ${APP_ROOT}`);
  if (existing && isAlive(existing)) {
    if (!processLooksLikeCharon(existing)) {
      log(`Ignoring stale pid ${existing} from ${PID_FILE}`);
      rmSync(PID_FILE, { force: true });
    } else {
      fail(
        `Charon has a running process (pid ${existing}) but ${LOCAL_URL}/up did not answer. Run "charon logs" or "charon stop" first.`,
      );
    }
  }
  const child = spawnServer({ detach: true });
  const health = await waitForHealth();
  if (!health) {
    rmSync(PID_FILE, { force: true });
    fail(`Charon did not become healthy. Check ${join(LOG_DIR, "charon.log")}`);
  }
  log(`Charon is ready at ${LOCAL_URL}`);
  if (open) openBrowser(LOCAL_URL);
}

async function stop() {
  const pid = readPid();
  if (!pid || !isAlive(pid)) {
    rmSync(PID_FILE, { force: true });
    log("Charon is not running.");
    return;
  }
  if (!processLooksLikeCharon(pid)) {
    rmSync(PID_FILE, { force: true });
    log(`Ignoring stale pid ${pid}; it does not look like Charon.`);
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Already gone.
  }
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && isAlive(pid)) {
    await new Promise((r) => setTimeout(r, 200));
  }
  if (isAlive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Ignore.
    }
  }
  rmSync(PID_FILE, { force: true });
  log("Charon stopped.");
}

async function status() {
  const pid = readPid();
  const health = await probeHealth();
  console.log(`Charon ${VERSION}`);
  console.log(`  home:   ${HOME}`);
  console.log(`  data:   ${DATA_DIR}`);
  console.log(`  url:    ${LOCAL_URL}`);
  console.log(`  pid:    ${pid && isAlive(pid) ? pid : "not running"}`);
  console.log(`  health: ${health.ok ? "ok" : "unreachable"}`);
  if (health.body) console.log(`  checks: ${JSON.stringify(health.body)}`);
}

function tailLogs(follow) {
  const logFile = join(LOG_DIR, "charon.log");
  if (!existsSync(logFile)) {
    log("No log file yet. Start Charon first.");
    return;
  }
  if (!follow) {
    process.stdout.write(readFileSync(logFile, "utf8"));
    return;
  }
  const child = spawn("tail", ["-n", "200", "-f", logFile], { stdio: "inherit" });
  child.on("error", () => log(`Open ${logFile} to read logs.`));
}

async function backup(destination) {
  const dbPath = process.env.DATABASE_URL || join(DATA_DIR, "charon.db");
  if (!existsSync(dbPath)) fail(`No database at ${dbPath} yet.`);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  // A backup is a directory: the database alone cannot decrypt provider keys
  // (that needs instance.json) and does not include character portraits.
  const target = resolve(destination || join(DATA_DIR, `backups/charon-${stamp}`));
  mkdirSync(target, { recursive: true });
  const dbTarget = join(target, "charon.db");
  try {
    const require = createRequire(join(APP_ROOT, ".output", "server", "node_modules", "x.js"));
    const Database = require("better-sqlite3");
    const db = new Database(dbPath, { readonly: true });
    await db.backup(dbTarget);
    db.close();
  } catch {
    // Fallback for a running WAL database: copy db + sidecars.
    copyFileSync(dbPath, dbTarget);
    for (const suffix of ["-wal", "-shm"]) {
      if (existsSync(dbPath + suffix)) copyFileSync(dbPath + suffix, dbTarget + suffix);
    }
  }
  if (existsSync(INSTANCE_FILE)) {
    copyFileSync(INSTANCE_FILE, join(target, "instance.json"));
  }
  const uploads = join(DATA_DIR, "uploads");
  if (existsSync(uploads)) cpSync(uploads, join(target, "uploads"), { recursive: true });
  log(`Backup written to ${target} (database, uploads, instance secrets)`);
}

function platformTag() {
  if (platform() === "win32") {
    // The Windows installer ships the x64 build for ARM64 too (emulation);
    // publishing a native arm64 asset is a separate decision.
    return "windows-x64";
  }
  const os = platform() === "darwin" ? "darwin" : "linux";
  const cpu = arch() === "arm64" ? "arm64" : "x64";
  return `${os}-${cpu}`;
}

async function download(url, target) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(target, bytes);
  return createHash("sha256").update(bytes).digest("hex");
}

async function update() {
  const tag = platformTag();
  const windows = platform() === "win32";
  const base = `https://github.com/${REPO}/releases/latest/download`;
  const asset = `charon-${tag}.${windows ? "zip" : "tar.gz"}`;
  const tmp = join(DATA_DIR, "update");
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  log(`Downloading ${asset}...`);
  try {
    await download(`${base}/${asset}.sha256`, join(tmp, "asset.sha256"));
    const digest = await download(`${base}/${asset}`, join(tmp, asset));
    const expected = readFileSync(join(tmp, "asset.sha256"), "utf8").trim().split(/\s+/)[0];
    if (!expected) throw new Error("The release checksum file is empty; refusing to update.");
    if (expected !== digest) throw new Error("Checksum mismatch; refusing to install the update.");

    // Stage the new tree next to the live one and validate it before touching
    // the running install. An update never extracts into the live directory.
    const staging = join(HOME, "app.new");
    rmSync(staging, { recursive: true, force: true });
    mkdirSync(staging, { recursive: true });
    // bsdtar on Windows reads .zip; GNU tar on macOS/Linux reads .tar.gz.
    const extract = spawn(
      "tar",
      windows ? ["-xf", join(tmp, asset), "-C", staging] : ["-xzf", join(tmp, asset), "-C", staging],
      { stdio: "inherit" },
    );
    const code = await new Promise((r) => extract.on("exit", r));
    if (code !== 0) throw new Error("Extraction failed; the running install was not touched.");
    for (const required of [
      "bin/charon.mjs",
      ".output/server/index.mjs",
      "drizzle",
      "LICENSE",
      "NOTICE",
    ]) {
      if (!existsSync(join(staging, required))) {
        throw new Error(`The update is missing ${required}; rolled back.`);
      }
    }

    // Snapshot the database, uploads, and the encryption key before the swap.
    // A failed update must not be the reason a chat history is lost.
    if (existsSync(process.env.DATABASE_URL || join(DATA_DIR, "charon.db"))) {
      await backup();
    }
    await stop();
    const appDir = join(HOME, "app");
    const old = join(HOME, "app.old");
    rmSync(old, { recursive: true, force: true });
    renameSync(appDir, old);
    try {
      renameSync(staging, appDir);
    } catch (error) {
      renameSync(old, appDir);
      throw new Error(`Could not activate the update: ${error.message}`);
    }
    writeFileSync(INSTALL_FILE, JSON.stringify({ version: "latest", updatedAt: new Date().toISOString() }, null, 2));
    log("Update installed. Starting...");
    await start({ open: true });
    // Keep app.old until the new server is healthy. If start exits, the old
    // tree is still on disk and can be restored with: mv app.old app
    rmSync(old, { recursive: true, force: true });
  } catch (error) {
    fail(`Update failed: ${error.message}. Your data in ${DATA_DIR} was not touched.`);
  }
}

async function doctor() {
  const rows = [];
  const push = (ok, label, detail = "") => rows.push({ ok, label, detail });
  const [major, minor] = process.versions.node.split(".").map(Number);
  push(major > 22 || (major === 22 && minor >= 14), "Node.js >= 22.14", process.version);
  push(existsSync(SERVER_ENTRY), "Server bundle", SERVER_ENTRY);
  push(existsSync(INSTANCE_FILE), "Instance secrets", INSTANCE_FILE);
  push(existsSync(join(APP_ROOT, "drizzle")), "Migrations", join(APP_ROOT, "drizzle"));
  try {
    ensureDirs();
    const probe = join(DATA_DIR, ".write-test");
    writeFileSync(probe, "ok");
    rmSync(probe);
    push(true, "Data directory writable", DATA_DIR);
  } catch (error) {
    push(false, "Data directory writable", error.message);
  }
  const health = await probeHealth();
  push(health.ok, "HTTP health", health.ok ? LOCAL_URL : health.error || "not running");
  if (health.body?.checks) push(false, "Health details", JSON.stringify(health.body.checks));
  for (const row of rows) console.log(`${row.ok ? "✓" : "✗"} ${row.label}: ${row.detail}`);
  if (rows.some((r) => !r.ok)) process.exitCode = 1;
}

function usage() {
  console.log(`Charon ${VERSION}

Usage: charon <command>

  start       Start Charon in the background and open it (default)
  serve       Run Charon in the foreground (Docker, systemd)
  stop        Stop the background server
  restart     Stop, then start
  status      Show URL, PID, and health
  open        Open Charon in your browser
  logs [-f]   Print the log, or follow it
  backup      Write a consistent SQLite backup
  doctor      Check runtime, data dir, and health
  update      Install the latest release
  version     Print the version

Environment:
  CHARON_HOME       Install directory   (default: ${HOME})
  CHARON_DATA_DIR   Data directory      (default: ${DATA_DIR})
  PORT              HTTP port           (default: 3000)
  CHARON_HOST       Bind address        (default: 127.0.0.1)
  APP_URL           Public URL for auth cookies (default: http://127.0.0.1:PORT)`);
}

async function main() {
  const [command = "start", ...args] = process.argv.slice(2);
  switch (command) {
    case "start":
    case "up":
      return start({ open: !args.includes("--no-open") });
    case "serve":
      return serve();
    case "stop":
      return stop();
    case "restart":
      await stop();
      return start({ open: true });
    case "status":
      return status();
    case "open":
      openBrowser(LOCAL_URL);
      return;
    case "logs":
      return tailLogs(args.includes("-f") || args.includes("--follow"));
    case "backup":
      return backup(args[0]);
    case "doctor":
      return doctor();
    case "update":
      return update();
    case "version":
    case "--version":
    case "-v":
      console.log(VERSION);
      return;
    case "help":
    case "--help":
    case "-h":
      return usage();
    default:
      usage();
      process.exitCode = 1;
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
