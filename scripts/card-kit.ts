#!/usr/bin/env tsx
/**
 * Card package tooling: check the fields, render the page, build a report.
 *
 *   pnpm card-kit check  [card ...] [--root DIR] [--network]
 *   pnpm card-kit render [card ...]
 *   pnpm card-kit all    [card ...]
 *
 * Default root: $CARD_ROOT or ~/codes/ComfyUI/chub/build. Output goes to
 * <root>/.cardkit/<card>/ (page.html, desktop.png, mobile.png, report.html).
 */
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import {
  buildReport,
  buildSubmitPayload,
  SUBMIT_SCRIPT,
  checkCard,
  checkImageUrls,
  findCards,
  loadCard,
  renderCard,
  type CardPackage,
} from "@/lib/cardkit";

const DEFAULT_ROOT = process.env.CARD_ROOT ?? join(homedir(), "codes/ComfyUI/chub/build");

function parseArgs(argv: string[]) {
  const rootIndex = argv.indexOf("--root");
  const root = rootIndex >= 0 ? resolve(argv[rootIndex + 1]) : resolve(DEFAULT_ROOT);
  const names = argv.filter(
    (arg, index) => !arg.startsWith("--") && (rootIndex < 0 || index !== rootIndex + 1),
  );
  return { root, names, network: argv.includes("--network") };
}

function printCheck(pkg: CardPackage, status: Awaited<ReturnType<typeof checkCard>>) {
  const errors = status.issues.filter((issue) => issue.level === "error");
  const warnings = status.issues.filter((issue) => issue.level === "warn");
  console.log(
    `${status.ok ? "ok  " : "FAIL"} ${pkg.name}: ${status.stats.greetings} greetings, ` +
      `${status.stats.images} images, ${status.stats.cssBytes} B css — ${errors.length} error(s), ${warnings.length} warning(s)`,
  );
  for (const issue of status.issues)
    console.log(`      ${issue.level} ${issue.code}: ${issue.message}`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "--help") {
    console.error(
      "usage: card-kit <check|render|report|submit|all> [card ...] [--root DIR] [--network]",
    );
    process.exit(2);
  }

  const { root, names, network } = parseArgs(rest);
  const dirs = (await findCards(root)).filter(
    (dir) => !names.length || names.includes(basename(dir)),
  );
  if (!dirs.length) throw new Error(`no card packages under ${root}`);

  for (const dir of dirs) {
    const pkg = await loadCard(dir);
    const outDir = join(root, ".cardkit", pkg.name);
    await mkdir(outDir, { recursive: true });

    if (command === "submit") {
      const payload = await buildSubmitPayload(pkg);
      const path = join(outDir, "submit.json");
      await writeFile(path, JSON.stringify(payload, null, 2));
      await writeFile(join(outDir, "submit-script.js"), SUBMIT_SCRIPT);
      console.log(
        `${pkg.name}: ${payload.alternates.length + 1} greetings, ${payload.tags.length} tags -> ${path}`,
      );
      continue;
    }

    if (command === "check" || command === "all") {
      const status = await checkCard(pkg);
      if (network) status.issues.push(...(await checkImageUrls(pkg)));
      printCheck(pkg, status);
      if (command === "check") continue;
    }

    const check = await checkCard(pkg);
    const renders =
      command === "render" || command === "report" || command === "all"
        ? await renderCard(pkg, outDir)
        : null;
    const report = await buildReport(pkg, check, renders, outDir);
    console.log(`      report ${report}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
