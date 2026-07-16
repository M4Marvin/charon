import { readFile } from "node:fs/promises";
import { createFileRoute } from "@tanstack/react-router";
import { getBackground } from "@/db/repositories/backgrounds";

export const Route = createFileRoute("/api/backgrounds/$id/image")({
  server: {
    handlers: {
      GET: async ({ request: _request, params }) => {
        console.log("[bg-image] handler entered, params.id =", params.id);

        let bg: ReturnType<typeof getBackground>;
        try {
          bg = getBackground(params.id);
          console.log("[bg-image] bg row found:", bg.id, "path:", bg.path);
        } catch (e) {
          console.error("[bg-image] getBackground FAILED for", params.id, "error:", e);
          return new Response("Not found", { status: 404 });
        }

        try {
          const bytes = await readFile(bg.path);
          console.log("[bg-image] served", bg.id, bg.path, "bytes:", bytes.length);
          return new Response(new Uint8Array(bytes), {
            headers: {
              "content-type": "image/png",
              "cache-control": "public, max-age=3600",
            },
          });
        } catch (e) {
          console.error("[bg-image] readFile failed for", bg.id, bg.path, e);
          return new Response("Background file missing", { status: 404 });
        }
      },
    },
  },
});
