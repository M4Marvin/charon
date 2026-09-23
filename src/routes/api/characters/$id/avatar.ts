import { createFileRoute } from "@tanstack/react-router";
import { getSession } from "@/server/session";
import { getCharacter } from "@/db/repositories/characters";
import { serveStoredImage } from "@/server/image-optimizer";

export const Route = createFileRoute("/api/characters/$id/avatar")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          await getSession();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        let character;
        try {
          character = getCharacter(params.id);
        } catch {
          return new Response("Character not found", { status: 404 });
        }

        if (!character.imagePath) {
          return new Response("No avatar", { status: 404 });
        }

        return serveStoredImage(request, character.imagePath);
      },
    },
  },
});
