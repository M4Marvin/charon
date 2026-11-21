import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import { workFile } from "@/server/cardkit";
import { getSession } from "@/server/session";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".html": "text/html; charset=utf-8",
};

/**
 * `/api/cardkit/<name>?file=desktop.png` — the file is a query parameter
 * because Vite's dev middleware intercepts paths that end in an image
 * extension before the router sees them.
 */
export const Route = createFileRoute("/api/cardkit/$name")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          await getSession();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        const file = new URL(request.url).searchParams.get("file") ?? "";
        const path = await workFile(params.name, file);
        if (!path) return new Response("Not found", { status: 404 });

        const body = await readFile(path);
        return new Response(new Uint8Array(body), {
          headers: {
            "content-type": TYPES[extname(path).toLowerCase()] ?? "application/octet-stream",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
