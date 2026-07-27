import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import { getSession } from "@/server/session";
import { getBackground } from "@/db/repositories/backgrounds";
import { diskPathFromStored, contentTypeForPath } from "@/server/uploads";

export const Route = createFileRoute("/api/backgrounds/$id/image")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          await getSession();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        let bg;
        try {
          bg = getBackground(params.id);
        } catch {
          return new Response("Background not found", { status: 404 });
        }

        if (!bg.path) {
          return new Response("No image", { status: 404 });
        }

        try {
          const bytes = await readFile(diskPathFromStored(bg.path));
          return new Response(new Uint8Array(bytes), {
            headers: {
              "content-type": contentTypeForPath(bg.path),
              "cache-control": "private, max-age=300",
            },
          });
        } catch {
          return new Response("File missing", { status: 404 });
        }
      },
    },
  },
});
