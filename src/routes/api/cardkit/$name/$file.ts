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

export const Route = createFileRoute("/api/cardkit/$name/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          await getSession();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        const path = await workFile(params.name, params.file);
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
