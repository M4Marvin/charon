import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildShell } from "./shell.js";
import type { CardPackage } from "./types.js";

const HELIUM = process.env.HELIUM_BIN ?? "/usr/bin/helium-browser";
const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

type Viewport = keyof typeof VIEWPORTS;

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function waitForDevtools(port: number, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Helium did not expose devtools on ${port}`);
}

type Session = {
  send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  once: (method: string) => Promise<void>;
  close: () => void;
};

async function openTarget(port: number, url: string): Promise<Session> {
  const target = (await (
    await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })
  ).json()) as { id: string; webSocketDebuggerUrl: string };

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map<number, (value: Record<string, unknown>) => void>();
  const events = new Map<string, () => void>();

  socket.onmessage = (message) => {
    const payload = JSON.parse(String(message.data)) as {
      id?: number;
      method?: string;
      result?: Record<string, unknown>;
      error?: { message: string };
    };
    if (payload.id && pending.has(payload.id)) {
      const resolve = pending.get(payload.id)!;
      pending.delete(payload.id);
      if (payload.error) throw new Error(payload.error.message);
      resolve(payload.result ?? {});
      return;
    }
    if (payload.method && events.has(payload.method)) {
      events.get(payload.method)!();
      events.delete(payload.method);
    }
  };

  await new Promise<void>((resolve) => (socket.onopen = () => resolve()));

  const send = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<Record<string, unknown>>((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });

  const once = (method: string) =>
    new Promise<void>((resolve) => events.set(method, () => resolve()));

  return {
    send,
    once,
    close: () => {
      socket.close();
      void fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
    },
  };
}

/** Screenshot a rendered page at one viewport using headless Helium over CDP. */
export async function screenshot(
  htmlPath: string,
  outPath: string,
  viewport: Viewport = "desktop",
  port: number,
): Promise<string> {
  const { width, height } = VIEWPORTS[viewport];
  const url = pathToFileURL(htmlPath).href;
  const session = await openTarget(port, url);
  try {
    await session.send("Page.enable");
    await session.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: viewport === "mobile",
    });
    const loaded = session.once("Page.loadEventFired");
    await session.send("Page.navigate", { url });
    await loaded;
    await session.send("Runtime.evaluate", {
      expression: "document.fonts ? document.fonts.ready.then(() => true) : true",
      awaitPromise: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const shot = (await session.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    })) as { data: string };
    const { writeFile } = await import("node:fs/promises");
    await writeFile(outPath, Buffer.from(shot.data, "base64"));
    return outPath;
  } finally {
    session.close();
  }
}

/**
 * Render a card page to `.cardkit/<card>/page.html` plus desktop/mobile PNGs.
 * Borders, hero and page CSS come from the card; the shell supplies chub's DOM.
 */
export async function renderCard(
  pkg: CardPackage,
  outDir: string,
): Promise<{ html: string; desktop: string; mobile: string }> {
  await mkdir(outDir, { recursive: true });
  const htmlPath = join(outDir, "page.html");
  await writeFile(htmlPath, await buildShell(pkg));

  const port = await freePort();
  const profile = await mkdtemp(join(tmpdir(), "cardkit-helium-"));
  const browser = spawn(
    HELIUM,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${port}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    await waitForDevtools(port);
    const desktop = await screenshot(htmlPath, join(outDir, "desktop.png"), "desktop", port);
    const mobile = await screenshot(htmlPath, join(outDir, "mobile.png"), "mobile", port);
    return { html: htmlPath, desktop, mobile };
  } finally {
    browser.kill("SIGKILL");
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}
