import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildAssetMap, rewriteAssets } from "./assets.js";
import type { CardPackage, CheckResult } from "./types.js";

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function greetingSection(pkg: CardPackage, map: Map<string, string>): string {
  return pkg.greetings
    .map((greeting, index) => {
      const thumbs = greeting.images
        .map(
          (url) =>
            `<a class="thumb" href="${escape(url)}" target="_blank"><img src="${escape(rewriteAssets(url, map))}" loading="lazy" alt=""></a>`,
        )
        .join("");
      return `<section class="greeting">
        <h3><span>${String(index + 1).padStart(2, "0")}</span> ${escape(greeting.id)} <em>${greeting.text.length} chars · ${greeting.images.length} image(s)</em></h3>
        <div class="greeting-body">
          <pre>${escape(greeting.text.slice(0, 1200))}${greeting.text.length > 1200 ? "…" : ""}</pre>
          <div class="thumbs">${thumbs || '<span class="missing">no image</span>'}</div>
        </div>
      </section>`;
    })
    .join("");
}

export async function buildReport(
  pkg: CardPackage,
  check: CheckResult,
  renders: { desktop: string; mobile: string } | null,
  outDir: string,
): Promise<string> {
  const issues = check.issues.length
    ? check.issues
        .map(
          (issue) =>
            `<li class="${issue.level}"><b>${issue.level}</b> <code>${escape(issue.code)}</code> ${escape(issue.message)}</li>`,
        )
        .join("")
    : "<li class=ok>no issues</li>";

  const rendersHtml = renders
    ? `<div class="renders">
         <figure><a href="desktop.png" target="_blank"><img src="desktop-thumb.jpg" alt="desktop"></a><figcaption>desktop · 1280</figcaption></figure>
         <figure><a href="mobile.png" target="_blank"><img src="mobile-thumb.jpg" alt="mobile"></a><figcaption>mobile · 390</figcaption></figure>
       </div>`
    : `<p class="missing">not rendered — run <code>card-kit render</code></p>`;

  const map = await buildAssetMap(pkg.dir);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escape(pkg.name)} — card report</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0b1118;color:#dfe7ee;font:14px/1.5 Inter,system-ui,sans-serif}
  header{padding:20px 24px;border-bottom:1px solid #223140;background:#0e1520;position:sticky;top:0;z-index:2}
  h1{margin:0;font-size:18px;letter-spacing:1px}
  header p{margin:4px 0 0;color:#8296a8;font-size:12px}
  main{padding:20px 24px 60px;max-width:1500px;margin:0 auto}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#7fb3c6;margin:28px 0 10px}
  ul.issues{list-style:none;margin:0;padding:0}
  ul.issues li{padding:6px 10px;border-left:3px solid #2a3a48;margin-bottom:6px;background:#101a24;font-size:13px}
  ul.issues li.error{border-color:#e2735b}
  ul.issues li.warn{border-color:#e0b25b}
  ul.issues li.ok{border-color:#4f9a7a;color:#8fb9a8}
  code{color:#9fc4d6}
  .renders{display:grid;grid-template-columns:2fr 1fr;gap:16px;align-items:start}
  .renders figure{margin:0;background:#121a24;border:1px solid #223140;border-radius:8px;overflow:hidden}
  .renders img{display:block;width:100%;height:auto;max-height:900px;object-fit:cover;object-position:top}
  .renders figcaption{padding:6px 10px;font-size:11px;color:#8296a8;border-top:1px solid #1b2733}
  .greeting{background:#101a24;border:1px solid #1e2c3a;border-radius:8px;margin-bottom:12px;padding:12px 14px}
  .greeting h3{margin:0 0 8px;font-size:13px;letter-spacing:1px}
  .greeting h3 span{color:#e2735b;margin-right:6px}
  .greeting h3 em{color:#6f8296;font-style:normal;font-size:11px;margin-left:6px}
  .greeting-body{display:grid;grid-template-columns:1fr 320px;gap:14px;align-items:start}
  pre{white-space:pre-wrap;margin:0;font:12px/1.6 ui-monospace,monospace;color:#a9bac9;max-height:260px;overflow:auto}
  .thumbs{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .thumb img{width:100%;height:110px;object-fit:cover;border-radius:6px;border:1px solid #223140}
  .missing{color:#e2735b;font-size:12px}
  @media(max-width:900px){.greeting-body{grid-template-columns:1fr}.renders{grid-template-columns:1fr}}
</style></head>
<body>
<header>
  <h1>${escape(pkg.name)}</h1>
  <p>${escape(pkg.dir)} · ${pkg.greetings.length} greetings · ${pkg.images.length} images · ${check.stats.cssBytes} B css · ${check.ok ? "checks pass" : "checks failed"}</p>
</header>
<main>
  <h2>Checks</h2>
  <ul class="issues">${issues}</ul>
  <h2>Render</h2>
  ${rendersHtml}
  <h2>Greetings</h2>
  ${greetingSection(pkg, map)}
</main>
</body></html>`;

  const path = join(outDir, "report.html");
  await writeFile(path, html);
  return path;
}
