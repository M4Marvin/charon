import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  buildAssetMap,
  buildReport,
  checkCard,
  findCards,
  loadCard,
  renderCard,
  type CheckResult,
} from "@/lib/cardkit";

export const CARD_ROOT = process.env.CARD_ROOT ?? join(homedir(), "codes/ComfyUI/chub/build");

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type CardSummary = {
  name: string;
  ok: boolean;
  errors: number;
  warnings: number;
  greetings: number;
  images: number;
  rendered: boolean;
  syncedAt: string | null;
};

export type CardDetail = Omit<CardSummary, "greetings"> & {
  greetingCount: number;
  dir: string;
  check: CheckResult;
  issues: CheckResult["issues"];
  renders: { desktop: string; mobile: string; html: string } | null;
  live: { syncedAt: string; raw: string } | null;
  greetings: { id: string; length: number; images: string[] }[];
};

function assertName(name: string): string {
  if (!SAFE_NAME.test(name)) throw new Error(`invalid card name: ${name}`);
  return name;
}

export function cardDir(name: string): string {
  return join(CARD_ROOT, assertName(name));
}

export function workDir(name: string): string {
  return join(CARD_ROOT, ".cardkit", assertName(name));
}

async function exists(path: string): Promise<boolean> {
  return Boolean(await stat(path).catch(() => null));
}

/** Serve only known work-dir files, or `art/<basename>` through the asset map. */
export async function workFile(name: string, file: string): Promise<string | null> {
  const dir = workDir(name);
  if (file.startsWith("art/")) {
    const map = await buildAssetMap(cardDir(name));
    return map.get(basename(file.slice(4))) ?? null;
  }
  if (!/^(desktop|mobile)\.png$|^(desktop|mobile)-thumb\.jpg$|^(report|page)\.html$/.test(file))
    return null;
  const path = resolve(dir, file);
  return path.startsWith(resolve(dir)) && (await exists(path)) ? path : null;
}

async function liveFor(name: string): Promise<CardDetail["live"]> {
  const raw = await readFile(join(cardDir(name), "live.json"), "utf8").catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { syncedAt?: string; data?: Record<string, unknown> };
    return parsed.syncedAt && parsed.data
      ? { syncedAt: parsed.syncedAt, raw: JSON.stringify(parsed.data, null, 2) }
      : null;
  } catch {
    return null;
  }
}

export async function listCards(): Promise<CardSummary[]> {
  const dirs = await findCards(CARD_ROOT);
  const cards: CardSummary[] = [];
  for (const dir of dirs) {
    const pkg = await loadCard(dir);
    const check = await checkCard(pkg);
    const live = await liveFor(pkg.name);
    cards.push({
      name: pkg.name,
      ok: check.ok,
      errors: check.issues.filter((issue) => issue.level === "error").length,
      warnings: check.issues.filter((issue) => issue.level === "warn").length,
      greetings: check.stats.greetings,
      images: check.stats.images,
      rendered: await exists(join(workDir(pkg.name), "desktop.png")),
      syncedAt: live?.syncedAt ?? null,
    });
  }
  return cards;
}

export async function cardDetail(name: string): Promise<CardDetail> {
  const dir = cardDir(name);
  const pkg = await loadCard(dir);
  const check = await checkCard(pkg);
  const live = await liveFor(name);
  const [desktop, mobile, html] = await Promise.all([
    exists(join(workDir(name), "desktop.png")),
    exists(join(workDir(name), "mobile.png")),
    exists(join(workDir(name), "page.html")),
  ]);
  const map = await buildAssetMap(dir);

  return {
    name: pkg.name,
    dir,
    ok: check.ok,
    check,
    issues: check.issues,
    errors: check.issues.filter((issue) => issue.level === "error").length,
    warnings: check.issues.filter((issue) => issue.level === "warn").length,
    greetingCount: check.stats.greetings,
    images: check.stats.images,
    rendered: desktop,
    syncedAt: live?.syncedAt ?? null,
    live,
    renders: desktop
      ? {
          desktop: `/api/cardkit/${name}?file=desktop-thumb.jpg`,
          mobile: mobile
            ? `/api/cardkit/${name}?file=mobile-thumb.jpg`
            : `/api/cardkit/${name}?file=desktop-thumb.jpg`,
          html: html ? `/api/cardkit/${name}?file=page.html` : "",
        }
      : null,
    greetings: pkg.greetings.map((greeting) => ({
      id: greeting.id,
      length: greeting.text.length,
      images: greeting.images.map((url) => {
        const local = map.get(basename(url.split("?")[0]));
        return local
          ? `/api/cardkit/${name}?file=${encodeURIComponent(`art/${basename(local)}`)}`
          : url;
      }),
    })),
  } satisfies CardDetail;
}

export async function renderAndReport(name: string): Promise<string> {
  const pkg = await loadCard(cardDir(name));
  const out = workDir(name);
  const check = await checkCard(pkg);
  const renders = await renderCard(pkg, out);
  return buildReport(pkg, check, renders, out);
}
