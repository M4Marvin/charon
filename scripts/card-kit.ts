#!/usr/bin/env tsx
/**
 * Card package tooling: check the fields, render the page, build a report.
 *
 *   pnpm card-kit check  [card ...] [--root DIR] [--network]
 *   pnpm card-kit render [card ...]
 *   pnpm card-kit submit <card> [--private] (create form: { script, payload })
 *   pnpm card-kit edit   <card> [--url U]  (edit form: { url, script, payload })
 *   pnpm card-kit next   <card> [--json]        (what the log says comes next)
 *   pnpm card-kit log    <card> [-n 20] [--json]
 *   pnpm card-kit generate <card> <NN> [count] [--port 8740]  (render a round of takes)
 *                                    [--tags] (re-derive take tags, no rendering)
 *                                    [--attach] (attach the confirmed take: JPG + embed + publish)
 *   pnpm card-kit vote   <card> [--port 8730]  (art vote page, serves until killed)
 *   pnpm card-kit all    [card ...]
 *
 * Default root: $CARD_ROOT or ~/codes/ComfyUI/chub/build. Output goes to
 * <root>/.cardkit/<card>/ (page.html, desktop.png, mobile.png, report.html).
 */
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  buildReport,
  buildSubmitPayload,
  editUrlFor,
  EDIT_SCRIPT,
  publishedUrl,
  SUBMIT_SCRIPT,
  checkCard,
  checkImageUrls,
  findCards,
  loadCard,
  renderCard,
  startVoteServer,
  cardState,
  formatLog,
  formatState,
  readLog,
  type CardPackage,
} from "@/lib/cardkit";

const argvJson = (argv: string[]) => argv.includes("--json");

const DEFAULT_ROOT = process.env.CARD_ROOT ?? join(homedir(), "codes/ComfyUI/chub/build");

function parseArgs(argv: string[]) {
  const rootIndex = argv.indexOf("--root");
  const urlIndex = argv.indexOf("--url");
  const portIndex = argv.indexOf("--port");
  const root = rootIndex >= 0 ? resolve(argv[rootIndex + 1]) : resolve(DEFAULT_ROOT);
  const names = argv.filter(
    (arg, index) =>
      !arg.startsWith("--") &&
      (rootIndex < 0 || index !== rootIndex + 1) &&
      (urlIndex < 0 || index !== urlIndex + 1) &&
      (portIndex < 0 || index !== portIndex + 1),
  );
  return {
    root,
    names,
    network: argv.includes("--network"),
    url: urlIndex >= 0 ? argv[urlIndex + 1] : undefined,
    port: portIndex >= 0 ? Number(argv[portIndex + 1]) : 8730,
    visibility: argv.includes("--private") ? ("Private" as const) : ("Public" as const),
  };
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
      "usage: card-kit <check|render|report|next|log|generate|vote|submit|edit|all> [card ...] [--root DIR] [--network] [--url URL] [--private]",
    );
    process.exit(2);
  }

  const { root, names, network, url, port, visibility } = parseArgs(rest);
  if (command === "next" || command === "log") {
    const dirs = (await findCards(root)).filter(
      (dir) => !names.length || names.includes(basename(dir)),
    );
    if (dirs.length !== 1) throw new Error(`${command} takes exactly one card`);
    const dir = dirs[0];
    const limitIndex = rest.indexOf("-n");
    const limit = limitIndex >= 0 ? Number(rest[limitIndex + 1]) : 200;
    if (command === "log") {
      const entries = await readLog(dir, limit);
      console.log(argvJson(rest) ? JSON.stringify(entries, null, 1) : formatLog(entries));
    } else {
      const state = await cardState(dir, basename(dir), limit);
      // the vote app owns the next-step verdict (it sees every live action);
      // prefer it when it is up, keep the local copy for when it is not
      try {
        const api = rest.includes("--port")
          ? `http://127.0.0.1:${port}`
          : "http://127.0.0.1:8740";
        const res = await fetch(`${api}/api/cards/${name}`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const card = (await res.json()) as { next?: typeof state.next };
          if (card.next) state.next = card.next;
        }
      } catch {
        // vote app down — the local verdict is fine
      }
      console.log(argvJson(rest) ? JSON.stringify(state, null, 1) : formatState(state));
    }
    return;
  }

  if (command === "generate") {
    const dirs = (await findCards(root)).filter(
      (dir) => !names.length || names.includes(basename(dir)),
    );
    if (dirs.length !== 1) throw new Error("generate takes exactly one card");
    const [greeting, count] = rest.filter((arg) => !arg.startsWith("--")).slice(1);
    if (!/^\d\d$/.test(greeting ?? "")) throw new Error("generate takes a greeting number, e.g. 05");
    const base = url ?? (rest.includes("--port") ? `http://127.0.0.1:${port}` : "http://127.0.0.1:8740");
    const name = basename(dirs[0]);
    const jobUrl = `${base}/api/cards/${name}/generate`;
    if (rest.includes("--status")) {
      const job = (await (await fetch(jobUrl)).json()) as { done?: boolean; error?: string; files?: string[] } | null;
      console.log(job ? (job.error ? `error: ${job.error}` : job.done ? (job.files ?? []).join(" ") || "no files" : "running") : "no job");
      return;
    }
    if (rest.includes("--tags")) {
      const post = await fetch(`${base}/api/cards/${name}/retag`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ greeting }),
      });
      if (!post.ok) throw new Error(`${post.status}: ${await post.text()}`);
      const { tags } = (await post.json()) as { tags: Record<string, unknown> };
      console.log(Object.keys(tags).length ? Object.keys(tags).join(" ") : "no tagged takes");
      return;
    }
    const repairIndex = rest.indexOf("--repair");
    if (repairIndex >= 0) {
      const take = rest[repairIndex + 1];
      if (!/^[a-p]$/.test(take ?? "")) throw new Error("--repair takes a take letter, e.g. --repair b");
      const post = await fetch(`${base}/api/cards/${name}/repair`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ greeting, take }),
      });
      if (!post.ok) throw new Error(`${post.status}: ${await post.text()}`);
      const { seed } = (await post.json()) as { seed: number };
      console.log(`${greeting}-${take}.png re-rendered, seed ${seed}`);
      return;
    }
    if (rest.includes("--attach")) {
      const post = await fetch(`${base}/api/cards/${name}/attach`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ greeting }),
      });
      if (!post.ok) throw new Error(`${post.status}: ${await post.text()}`);
      const { file, published } = (await post.json()) as { file: string; published: true | string };
      console.log(published === true ? `${file} attached` : `${file} attached, publish failed: ${published}`);
      return;
    }
    const post = await fetch(jobUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // direct: the runner already wrote the prompts; render without
      // re-delegating to the runner
      body: JSON.stringify({ greeting, count: Number(count) || 5, direct: true }),
    });
    if (!post.ok) throw new Error(`${post.status}: ${await post.text()}`);
    for (;;) {
      const job = (await (await fetch(jobUrl)).json()) as {
        done?: boolean;
        error?: string;
        files?: string[];
      };
      if (job.error) throw new Error(job.error);
      if (job.done) {
        console.log(job.files?.length ? job.files.join(" ") : "no files");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  if (command === "vote") {
    const dirs = (await findCards(root)).filter(
      (dir) => !names.length || names.includes(basename(dir)),
    );
    if (dirs.length !== 1) throw new Error("vote takes exactly one card");
    const server = await startVoteServer(dirs[0], port);
    console.log(`vote page: ${server.local}${server.tailnet ? `  (tailnet ${server.tailnet})` : ""}`);
    await new Promise(() => {});
    return;
  }
  const dirs = (await findCards(root)).filter(
    (dir) => !names.length || names.includes(basename(dir)),
  );
  if (!dirs.length) throw new Error(`no card packages under ${root}`);

  for (const dir of dirs) {
    const pkg = await loadCard(dir);
    const outDir = join(root, ".cardkit", pkg.name);
    await mkdir(outDir, { recursive: true });

    if (command === "submit") {
      const payload = await buildSubmitPayload(pkg, visibility);
      console.log(JSON.stringify({ script: SUBMIT_SCRIPT, payload }));
      continue;
    }

    if (command === "edit") {
      const payload = await buildSubmitPayload(pkg);
      const target = url ?? editUrlFor(await publishedUrl(dir));
      if (!target) throw new Error(`${pkg.name}: no Published URL in metadata.md — pass --url`);
      console.log(JSON.stringify({ url: target, script: EDIT_SCRIPT, payload }));
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
