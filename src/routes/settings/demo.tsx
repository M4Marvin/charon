import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { Spinner } from "@/components/ui/spinner";
import { getSession } from "@/lib/auth.functions";
import { useGlobalAiConfig, useUpdateGlobalAiConfig } from "@/hooks/useGlobalAiConfig";

export const Route = createFileRoute("/settings/demo")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session || session.user.role !== "admin") throw redirect({ to: "/settings/preferences" });
  },
  component: DemoProviderPage,
});

function DemoProviderPage() {
  const { data: config, isLoading, error } = useGlobalAiConfig();
  const updateMutation = useUpdateGlobalAiConfig();

  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("");

  useEffect(() => {
    if (config) {
      setBaseUrl(config.baseUrl);
      setApiKey(config.apiKey);
      setDefaultModel(config.defaultModel ?? "");
    }
  }, [config]);

  const handleSave = () => {
    updateMutation.mutate(
      { baseUrl, apiKey, defaultModel },
      {
        onSuccess: () => toast.success("Demo AI provider updated"),
        onError: (e) =>
          toast.error(`Failed to update: ${e instanceof Error ? e.message : String(e)}`),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorBanner message={error instanceof Error ? error.message : "Failed to load config"} />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-title">Demo Provider</h2>
      <p className="text-2 text-sm">
        All demo users share this provider. Changes take effect immediately.
      </p>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="demo-base-url">Base URL</Label>
          <Input
            id="demo-base-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="demo-api-key">API Key</Label>
          <Input
            id="demo-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="demo-model">Default Model</Label>
          <Input
            id="demo-model"
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            placeholder="gpt-4o-mini"
          />
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full">
          {updateMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
