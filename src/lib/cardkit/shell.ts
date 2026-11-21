import { buildAssetMap, rewriteAssets } from "./assets.js";
import type { CardPackage } from "./types.js";

/**
 * Minimal chub-shaped page: header, avatar column, content column, and the
 * injected paragraph colour. It exists so a card's page CSS (written against
 * chub's DOM) can be rendered and screenshotted locally.
 */
export async function buildShell(pkg: CardPackage): Promise<string> {
  const page = rewriteAssets(pkg.page ?? "", await buildAssetMap(pkg.dir));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${pkg.name}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#030408;color:#d0d3d4;font-family:Inter,system-ui,sans-serif}
  .ant-layout-header{display:flex;align-items:center;justify-content:space-between;height:56px;padding:0 24px;background:#0b0f16;border-bottom:1px solid #1e2733;font-size:13px;letter-spacing:2px;color:#8ea0b3;text-transform:uppercase}
  .ant-row{display:flex;flex-wrap:wrap;width:100%}
  .ant-col-lg-6{flex:0 0 25%;max-width:25%;position:relative}
  .ant-col-lg-18{flex:0 0 75%;max-width:75%;position:relative}
  .mt-4{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
  .ant-btn{font:inherit;font-size:14px;padding:10px 18px;border-radius:8px;border:1px solid #2c3b4d;background:#121a24;color:#d0d3d4;display:inline-flex;align-items:center;gap:8px}
  .ant-btn svg{width:16px;height:16px}
  .font-size-message{font-size:13px;color:#8ea0b3;padding:10px 24px}
  .ant-ribbon-text,.galaxy-bg,spacer{display:none}
  .eedsfu p{color:#e5e0d8}
</style></head>
<body>
<header class="ant-layout-header"><span>chub</span><span>Create</span></header>
<svg class="lucide lucide-messages-square" style="display:none"></svg>
<div class="ant-row ant-row-center">
  <div class="ant-col-lg-6">
    <div class="mt-4">
      <button class="ant-btn"><svg class="lucide lucide-messages-square"></svg> Chat with ${pkg.name}</button>
      <button class="ant-btn">Import Chat</button>
      <button class="ant-btn">Download</button>
    </div>
  </div>
  <div class="ant-col-lg-18">
    <div class="font-size-message">This character may contain content intended for adults.</div>
    <div class="eedsfu">${page}</div>
  </div>
</div>
</body></html>`;
}
