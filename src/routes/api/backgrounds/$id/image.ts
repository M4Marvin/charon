import { readFile } from "node:fs/promises";
import { createFileRoute } from "@tanstack/react-router";
import { getBackground } from "@/db/repositories/backgrounds";
import { getSession } from "@/server/session";

export const Route = createFileRoute("/api/backgrounds/$id/image")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          await getSession();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        let bg: ReturnType<typeof getBackground>;
        try {
          bg = getBackground(params.id);
        } catch {
          return new Response("Not found", { status: 404 });
        }

        try {
          const bytes = await readFile(bg.path);
          return new Response(new Uint8Array(bytes), {
            headers: {
              "content-type": "image/png",
              "cache-control": "private, max-age=300",
            },
          });
        } catch {
          return new Response("Background file missing", { status: 404 });
        }
      },
    },
  },
});
