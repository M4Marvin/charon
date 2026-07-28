import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSession } from "@/lib/auth.functions";
import { ErrorBanner } from "@/components/common/ErrorBanner";

export const Route = createFileRoute("/settings/presets")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session || session.user.role !== "admin") throw redirect({ to: "/settings/preferences" });
  },
  component: () => (
    <div className="space-y-4">
      <h2 className="text-title">Presets</h2>
      <ErrorBanner message="Preset management has moved and will be available shortly." />
    </div>
  ),
});
