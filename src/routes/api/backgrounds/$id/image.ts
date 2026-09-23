import { createFileRoute } from "@tanstack/react-router";
import { getSession } from "@/server/session";
import { getBackground } from "@/db/repositories/backgrounds";
import { serveStoredImage } from "@/server/image-optimizer";

export const Route = createFileRoute("/api/backgrounds/$id/image")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
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

        return serveStoredImage(request, bg.path);
      },
    },
  },
});
