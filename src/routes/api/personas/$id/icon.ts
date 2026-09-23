import { createFileRoute } from "@tanstack/react-router";
import { getSession } from "@/server/session";
import { getPersona } from "@/db/repositories/personas";
import { serveStoredImage } from "@/server/image-optimizer";

export const Route = createFileRoute("/api/personas/$id/icon")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          await getSession();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        let persona;
        try {
          persona = getPersona(params.id);
        } catch {
          return new Response("Persona not found", { status: 404 });
        }

        if (!persona.iconPath) {
          return new Response("No icon", { status: 404 });
        }

        return serveStoredImage(request, persona.iconPath);
      },
    },
  },
});
