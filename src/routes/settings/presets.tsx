import { createFileRoute, Link } from "@tanstack/react-router";
import { PresetManager } from "@/components/preset/PresetManager";

export const Route = createFileRoute("/settings/presets")({
  component: PresetsPage,
});

function PresetsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-title">Presets</h2>
      <p className="text-2 text-sm">
        Save generation parameters (temperature, tokens, etc.) as reusable presets. Choose the
        default preset in{" "}
        <Link to="/settings/defaults" className="text-brand underline">
          AI defaults
        </Link>
        .
      </p>
      <PresetManager />
    </div>
  );
}
