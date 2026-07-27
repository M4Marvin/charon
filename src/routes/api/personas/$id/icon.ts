import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import { getSession } from "@/server/session";
import { getPersona } from "@/db/repositories/personas";
import { diskPathFromStored, contentTypeForPath } from "@/server/uploads";

export const Route = createFileRoute("/api/personas/$id/icon")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        let user;
        try {
          user = (await getSession()).user;
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        let persona;
        try {
          persona = getPersona(user.id, params.id);
        } catch {
          return new Response("Persona not found", { status: 404 });
        }

        if (!persona.iconPath) {
          return new Response("No icon", { status: 404 });
        }

        try {
          const bytes = await readFile(diskPathFromStored(persona.iconPath));
          return new Response(new Uint8Array(bytes), {
            headers: {
              "content-type": contentTypeForPath(persona.iconPath),
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
