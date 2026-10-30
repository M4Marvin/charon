import { createFileRoute, Link } from "@tanstack/react-router";
import { ProviderManager } from "@/components/ai/ProviderManager";

export const Route = createFileRoute("/settings/providers")({
  component: ProvidersPage,
});

function ProvidersPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-title">Providers</h2>
      <p className="text-2 text-sm">
        Set the default model in{" "}
        <Link to="/settings/defaults" className="text-brand underline">
          AI defaults
        </Link>
        .
      </p>
      <ProviderManager />
    </div>
  );
}
