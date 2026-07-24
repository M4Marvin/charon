import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import {
  diskPathFromStored,
  storedPathFromDiskComponents,
  UPLOADS_SUBDIRS,
  type UploadSubdir,
} from "@/server/uploads";

const validTypes: Set<string> = new Set(Object.values(UPLOADS_SUBDIRS));
const extensions = [".png", ".jpg", ".jpeg", ".webp"] as const;

const contentTypeMap: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export const Route = createFileRoute("/uploads/$type/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { type, id } = params;

        if (!validTypes.has(type)) {
          return new Response("Invalid type", { status: 400 });
        }
        if (!/^[\w-]+$/.test(id)) {
          return new Response("Invalid filename", { status: 400 });
        }

        let bytes: Buffer | null = null;
        let resolvedExt = "";

        for (const ext of extensions) {
          const stored = storedPathFromDiskComponents(
            type as UploadSubdir,
            `${id}${ext}`,
          );
          const diskPath = diskPathFromStored(stored);
          try {
            bytes = await readFile(diskPath);
            resolvedExt = ext;
            break;
          } catch {}
        }

        if (!bytes) {
          return new Response("Not found", { status: 404 });
        }

        return new Response(new Uint8Array(bytes) as BodyInit, {
          headers: {
            "Content-Type": contentTypeMap[resolvedExt],
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
