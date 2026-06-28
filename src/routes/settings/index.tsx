import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Check, RotateCw, Zap } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAiProviders, type AiProviderListItem } from "@/hooks/useAiProviders";
import {
  useCreateAiProvider,
  useDeleteAiProvider,
  useTestProviderConnection,
  useUpdateAiProvider,
} from "@/hooks/useAiProviders";
import { useProviderModels } from "@/hooks/useProviderModels";
import {
  usePresets,
  useCreatePreset,
  useUpdatePreset,
  useDeletePreset,
  type PresetListItem,
} from "@/hooks/usePresets";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/useUserSettings";
import { ProviderDialog } from "@/components/ai/ProviderDialog";
import { PresetDialog } from "@/components/preset/PresetDialog";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: session } = authClient.useSession();
  const isMarv = session?.user?.username === "marv";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link to="/chats">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm">
            Configure AI providers, presets, and defaults.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <AiProvidersSection />
        <PresetsSection />

        {isMarv && (
          <>
            <hr className="border-border/40" />
            <DemoAiConfigSection />
          </>
        )}
      </div>
    </main>
  );
}

function AiProvidersSection() {
  const { data: userSettings } = useUserSettings();
  const updateUserDefaults = useUpdateUserSettings();
  const { data: providers = [] } = useAiProviders();
  const createProvider = useCreateAiProvider();
  const updateProvider = useUpdateAiProvider();
  const deleteProvider = useDeleteAiProvider();
  const testConnection = useTestProviderConnection();

  const selectedProviderId = userSettings?.defaultProviderId ?? "";

  const {
    data: models = [],
    isLoading: modelsLoading,
    error: modelsError,
    refetch: refetchModels,
  } = useProviderModels(selectedProviderId);

  const [editingProvider, setEditingProvider] = useState<AiProviderListItem | "new" | null>(null);

  const handleChangeProvider = useCallback(
    (providerId: string) => {
      updateUserDefaults.mutate({
        defaultProviderId: providerId || null,
        defaultSelectedModel: null,
        defaultPresetId: null,
      });
    },
    [updateUserDefaults],
  );

  const handleChangeModel = useCallback(
    (model: string) => {
      updateUserDefaults.mutate({ defaultSelectedModel: model || null });
    },
    [updateUserDefaults],
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">AI Providers</h2>
        <p className="text-muted-foreground text-xs">
          Manage your OpenAI-compatible API endpoints. These are shared across all your chats.
        </p>
      </div>

      {/* Provider select */}
      <div className="space-y-1">
        <Label className="text-xs">Default provider</Label>
        <div className="flex gap-1.5">
          <div className="flex-1">
            <Select
              value={selectedProviderId || "_none"}
              onValueChange={(v) => handleChangeProvider(v === "_none" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— None —</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedProviderId && (
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0"
              disabled={testConnection.isPending}
              onClick={() => testConnection.mutate(selectedProviderId)}
              aria-label="Test connection"
            >
              {testConnection.isPending ? <Spinner /> : <Zap className="size-3.5" />}
            </Button>
          )}
        </div>

        {testConnection.data && (
          <div
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
              testConnection.data.ok
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {testConnection.data.ok ? (
              <>
                <Check className="size-3 shrink-0" />
                <span>
                  {testConnection.data.latencyMs}ms &middot; {testConnection.data.modelCount} models
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="size-3 shrink-0" />
                <span className="min-w-0 break-all">
                  {testConnection.data.error ?? "Unknown error"}
                </span>
                <Button
                  size="sm"
                  variant="link"
                  className="ml-auto h-auto shrink-0 px-1 py-0 text-xs"
                  onClick={() => testConnection.mutate(selectedProviderId)}
                >
                  Retry
                </Button>
              </>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditingProvider("new")}
          >
            + Add provider
          </Button>
          {selectedProviderId && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const p = providers.find((x) => x.id === selectedProviderId);
                  if (p) setEditingProvider(p);
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!window.confirm("Delete this provider?")) return;
                  deleteProvider.mutate(
                    { id: selectedProviderId },
                    {
                      onSuccess: () => {
                        toast.success("Provider deleted");
                        testConnection.reset();
                        handleChangeProvider("");
                      },
                      onError: (e) => toast.error(`Delete failed: ${(e as Error).message}`),
                    },
                  );
                }}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Model select */}
      <div className="space-y-1">
        <Label className="text-xs">Default model</Label>
        <div className="flex gap-1.5">
          <div className="flex-1">
            <Select
              value={userSettings?.defaultSelectedModel ?? ""}
              onValueChange={handleChangeModel}
              disabled={!selectedProviderId}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    !selectedProviderId
                      ? "Select a provider first"
                      : modelsLoading && models.length === 0
                        ? "Loading models..."
                        : "Select model"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id}
                  </SelectItem>
                ))}
                {models.length === 0 && selectedProviderId && !modelsLoading && !modelsError && (
                  <div className="text-muted-foreground px-3 py-2 text-xs">No models found</div>
                )}
              </SelectContent>
            </Select>
          </div>
          {selectedProviderId && (
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0"
              disabled={modelsLoading}
              onClick={() => refetchModels()}
              aria-label="Reload models"
            >
              <RotateCw className={`size-3.5 ${modelsLoading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
        <Input
          value={userSettings?.defaultSelectedModel ?? ""}
          onChange={(e) => handleChangeModel(e.target.value)}
          placeholder="Or type model ID"
          className="mt-1"
        />
        {modelsError && !modelsLoading && (
          <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
            <AlertTriangle className="size-3 shrink-0" />
            <span className="min-w-0 break-all">
              {modelsError instanceof Error ? modelsError.message : "Failed to load models"}
            </span>
            <Button
              size="sm"
              variant="link"
              className="ml-auto h-auto shrink-0 px-1 py-0 text-xs"
              onClick={() => refetchModels()}
            >
              Retry
            </Button>
          </div>
        )}
      </div>

      <ProviderDialog
        state={editingProvider}
        onClose={() => setEditingProvider(null)}
        onCreate={(input) =>
          createProvider.mutate(input, {
            onSuccess: ({ id }) => {
              toast.success("Provider created");
              setEditingProvider(null);
              handleChangeProvider(id);
            },
            onError: (e) => toast.error(`Create failed: ${(e as Error).message}`),
          })
        }
        onUpdate={(input) =>
          updateProvider.mutate(input, {
            onSuccess: () => {
              toast.success("Provider updated");
              setEditingProvider(null);
            },
            onError: (e) => toast.error(`Update failed: ${(e as Error).message}`),
          })
        }
      />
    </section>
  );
}

function PresetsSection() {
  const { data: providers = [] } = useAiProviders();
  const { data: userSettings } = useUserSettings();
  const updateUserDefaults = useUpdateUserSettings();
  const { data: presets = [] } = usePresets();
  const createPreset = useCreatePreset();
  const updatePreset = useUpdatePreset();
  const deletePreset = useDeletePreset();

  const selectedPresetId = userSettings?.defaultPresetId ?? "";
  const [editing, setEditing] = useState<PresetListItem | "new" | null>(null);

  const handleChangePreset = useCallback(
    (presetId: string) => {
      updateUserDefaults.mutate({ defaultPresetId: presetId || null });
    },
    [updateUserDefaults],
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Presets</h2>
        <p className="text-muted-foreground text-xs">
          Save generation parameters (temperature, tokens, etc.) as reusable presets.
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Default preset</Label>
        <Select
          value={selectedPresetId || "_none"}
          onValueChange={(v) => handleChangePreset(v === "_none" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select preset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">— None —</SelectItem>
            {presets.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            + Add preset
          </Button>
          {selectedPresetId && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const p = presets.find((x) => x.id === selectedPresetId);
                  if (p) setEditing(p);
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!window.confirm("Delete this preset?")) return;
                  deletePreset.mutate(
                    { id: selectedPresetId },
                    {
                      onSuccess: () => {
                        toast.success("Preset deleted");
                        handleChangePreset("");
                      },
                      onError: (e) => toast.error(`Delete failed: ${(e as Error).message}`),
                    },
                  );
                }}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <PresetDialog
        state={editing}
        providers={providers}
        defaultModel={userSettings?.defaultSelectedModel ?? ""}
        onClose={() => setEditing(null)}
        onCreate={(input) =>
          createPreset.mutate(input, {
            onSuccess: () => {
              toast.success("Preset created");
              setEditing(null);
            },
            onError: (e) => toast.error(`Create failed: ${(e as Error).message}`),
          })
        }
        onUpdate={(input) =>
          updatePreset.mutate(input, {
            onSuccess: () => {
              toast.success("Preset updated");
              setEditing(null);
            },
            onError: (e) => toast.error(`Update failed: ${(e as Error).message}`),
          })
        }
      />
    </section>
  );
}

function DemoAiConfigSection() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { getGlobalAiConfig } = await import("@/server/fns/admin");
        const config = await getGlobalAiConfig();
        setBaseUrl(config.baseUrl);
        setApiKey(config.apiKey);
        setDefaultModel(config.defaultModel ?? "");
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { updateGlobalAiConfig } = await import("@/server/fns/admin");
      await updateGlobalAiConfig({ data: { baseUrl, apiKey, defaultModel } });
      toast.success("Demo AI provider updated");
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  }, [baseUrl, apiKey, defaultModel]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Demo AI Provider</h2>
        <p className="text-muted-foreground text-xs">
          All demo users share this provider. Changes take effect immediately.
        </p>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Base URL</Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">API Key</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Default Model</Label>
          <Input
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            placeholder="gpt-4o-mini"
          />
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </section>
  );
}
