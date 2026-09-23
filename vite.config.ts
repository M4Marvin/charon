import { defineConfig, loadEnv } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

import viteReact from "@vitejs/plugin-react";
import { privateAssetDevPlugin, VITE_FS_DENY } from "./scripts/vite-dev-policy";
import tailwindcss from "@tailwindcss/vite";

// Vite does not populate `process.env` from `.env*` files when evaluating an
// object config, so read them explicitly. `loadEnv` also merges any VITE_ vars
// already exported in the shell.
const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "VITE_");

const lanHosts = (env.VITE_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

const config = defineConfig({
  // Keep migration inputs under public/ out of both dev and production static serving.
  publicDir: "static",
  // Dev-only (ignored by `vite build` and the prod server): extra hosts for
  // `pnpm dev:lan`, via VITE_ALLOWED_HOSTS in .env.local. Unset = localhost only.
  server: {
    ...(lanHosts.length > 0 ? { allowedHosts: lanHosts } : {}),
    fs: {
      strict: true,
      // The middleware below also blocks ordinary /data URLs; these deny
      // Vite's raw filesystem handler for equivalent /@fs requests. Keep
      // Vite's default secret/repository denials when extending the list.
      deny: [...VITE_FS_DENY],
    },
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "use-sync-external-store/shim/with-selector": "use-sync-external-store/shim/with-selector.js",
      "use-sync-external-store/shim": "use-sync-external-store/shim/index.js",
    },
  },
  optimizeDeps: {
    include: ["use-sync-external-store/shim/with-selector", "use-sync-external-store/shim"],
  },
  plugins: [
    devtools(),
    tailwindcss(),
    privateAssetDevPlugin(),
    nitro({
      publicAssets: [
        { dir: "static", maxAge: 0 },
        { dir: "public", ignore: ["**"], maxAge: 0 },
      ],
    }),
    tanstackStart({
      router: {
        // Colocated route tests (e.g. characters/new.test.tsx) and non-route
        // helper modules (e.g. characters/detail-helpers.ts) would otherwise be
        // picked up as route candidates and warned about on every build.
        routeFileIgnorePattern: "\\.test\\.|^delete-stats\\.ts$|^detail-helpers\\.ts$",
      },
    }),
    viteReact(),
  ],
});

export default config;
