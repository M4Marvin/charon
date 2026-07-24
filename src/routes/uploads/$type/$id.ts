import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  diskPathFromStored,
  UPLOADS_SUBDIRS,
} from "@/server/uploads";

const validTypes: Set<string> = new Set(Object.values(UPLOADS_SUBDIRS));

export const Route = createFileRoute("/uploads/$type/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { type, id } = params;

        if (!validTypes.has(type)) {
          return new Response("Invalid type", { status: 400 });
        }
        if (!/^[\w-]+\.png$/.test(id)) {
          return new Response("Invalid filename", { status: 400 });
        }

        const diskPath = diskPathFromStored(join(type, id));

        try {
          const bytes = await readFile(diskPath);
          return new Response(bytes, {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
