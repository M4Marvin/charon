import { createFileRoute } from "@tanstack/react-router";
import { ModelDefaultsFields } from "@/components/ai/ModelDefaultsFields";

export const Route = createFileRoute("/settings/defaults")({
  component: DefaultsPage,
});

function DefaultsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-title">AI defaults</h2>
        <p className="text-2 text-sm">
          The provider, model, and preset used when a chat does not override them. These are shared
          across all chats.
        </p>
      </div>
      <ModelDefaultsFields />
    </div>
  );
}
