import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import { getSession } from "@/server/session";
import { getCharacter } from "@/db/repositories/characters";
import { diskPathFromStored, contentTypeForPath } from "@/server/uploads";

export const Route = createFileRoute("/api/characters/$id/avatar")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        let user;
        try {
          user = (await getSession()).user;
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        let character;
        try {
          character = getCharacter(user.id, params.id);
        } catch {
          return new Response("Character not found", { status: 404 });
        }

        if (!character.imagePath) {
          return new Response("No avatar", { status: 404 });
        }

        try {
          const bytes = await readFile(diskPathFromStored(character.imagePath));
          return new Response(new Uint8Array(bytes), {
            headers: {
              "content-type": contentTypeForPath(character.imagePath),
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
