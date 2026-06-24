import { readFile } from "node:fs/promises";
import { createFileRoute } from "@tanstack/react-router";
import { getCharacter } from "@/db/repositories/characters";
import { getSession } from "@/server/session";

export const Route = createFileRoute("/api/characters/$id/avatar")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        let session: Awaited<ReturnType<typeof getSession>>;
        try {
          session = await getSession();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        let character: ReturnType<typeof getCharacter>;
        try {
          character = getCharacter(session.user.id, params.id);
        } catch {
          return new Response("Not found", { status: 404 });
        }

        if (!character.imagePath) {
          return new Response("Not found", { status: 404 });
        }

        try {
          const bytes = await readFile(character.imagePath);
          return new Response(new Uint8Array(bytes), {
            headers: {
              "content-type": "image/png",
              "cache-control": "private, max-age=300",
            },
          });
        } catch {
          return new Response("Avatar file missing", { status: 404 });
        }
      },
    },
  },
});
