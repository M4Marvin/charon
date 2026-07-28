import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSession } from "@/lib/auth.functions";

export const Route = createFileRoute("/settings/")({
  beforeLoad: async () => {
    const session = await getSession();
    if (session?.user?.role === "admin") {
      throw redirect({ to: "/settings/providers" });
    }
    throw redirect({ to: "/settings/preferences" });
  },
});
