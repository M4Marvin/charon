import { useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Zap, RotateCw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldLabel } from "@/components/ui/field";
import { useAiProviders, useTestProviderConnection } from "@/hooks/useAiProviders";
import { usePresets } from "@/hooks/usePresets";
import { useProviderModels } from "@/hooks/useProviderModels";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/useUserSettings";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
  isAdmin: boolean;
}

export function ConnectionSection({ isStreaming, isAdmin }: SectionProps) {
  const { data: settings } = useUserSettings();
  const { data: providers } = useAiProviders();
  const { data: presets } = usePresets();
  const updateUserSettings = useUpdateUserSettings();
  const {
    data: models,
    isLoading: modelsLoading,
    isError: modelsError,
    refetch: refetchModels,
  } = useProviderModels(settings?.defaultProviderId ?? "");
  const testConnection = useTestProviderConnection();

  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latencyMs: number;
    modelCount: number;
    error?: string;
  } | null>(null);
  const [modelInput, setModelInput] = useState(settings?.defaultSelectedModel ?? "");

  const selectedProviderId = settings?.defaultProviderId ?? "";
  const selectedModel = settings?.defaultSelectedModel ?? "";
  const selectedPresetId = settings?.defaultPresetId ?? "";

  const handleProviderChange = useCallback(
    (providerId: string) => {
      updateUserSettings.mutate({
        defaultProviderId: providerId,
        defaultSelectedModel: null,
        defaultPresetId: null,
      });
      setTestResult(null);
      setModelInput("");
    },
    [updateUserSettings],
  );

  const handleModelChange = useCallback(
    (model: string) => {
      const v = model.trim() || null;
      updateUserSettings.mutate({ defaultSelectedModel: v ?? null });
      setModelInput(v ?? "");
    },
    [updateUserSettings],
  );

  const handlePresetChange = useCallback(
    (presetId: string) => {
      updateUserSettings.mutate({ defaultPresetId: presetId === "_none" ? null : presetId });
    },
    [updateUserSettings],
  );

  const handleTest = useCallback(() => {
    if (!selectedProviderId) return;
    setTestResult(null);
    testConnection.mutate(selectedProviderId, {
      onSuccess: (r) => setTestResult(r),
      onError: () =>
        setTestResult({ ok: false, latencyMs: 0, modelCount: 0, error: "Connection failed" }),
    });
  }, [selectedProviderId, testConnection]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-heading text-[--sea-ink]">Connection</p>
        <Button
          variant="link"
          size="sm"
          className="h-auto gap-1 p-0 text-[11px] text-[--lagoon]"
          asChild
        >
          <Link to="/settings">
            Manage providers & presets
            <ArrowRight className="size-3" data-icon="inline-end" />
          </Link>
        </Button>
      </div>

      <Field className="space-y-1.5">
        <FieldLabel htmlFor="cs-provider">Provider</FieldLabel>
        <div className="flex gap-2">
          <Select
            value={selectedProviderId}
            onValueChange={handleProviderChange}
            disabled={isStreaming}
          >
            <SelectTrigger id="cs-provider" className="flex-1">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {providers?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            disabled={isStreaming || !selectedProviderId || testConnection.isPending}
            onClick={handleTest}
            aria-label="Test provider connection"
          >
            {testConnection.isPending ? <Spinner className="size-4" /> : <Zap className="size-4" />}
          </Button>
        </div>
      </Field>

      {testResult && (
        <div role="status" className="rounded-lg border border-white/5 px-3 py-2 text-xs">
          {testResult.ok ? (
            <span className="text-green-400">
              Connected — {testResult.latencyMs}ms, {testResult.modelCount} models
            </span>
          ) : (
            <span className="text-red-400">
              Failed{testResult.error ? `: ${testResult.error}` : ""}
            </span>
          )}
        </div>
      )}

      <Field className="space-y-1.5">
        <FieldLabel htmlFor="cs-model">Model</FieldLabel>
        <div className="flex gap-2">
          <Select
            value={selectedModel}
            onValueChange={handleModelChange}
            disabled={isStreaming || !selectedProviderId || !isAdmin}
          >
            <SelectTrigger id="cs-model" className="flex-1">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {modelsLoading && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Loading models…</div>
                )}
                {modelsError && (
                  <div className="px-2 py-1.5 text-xs text-red-400">Failed to load models</div>
                )}
                {models?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            disabled={isStreaming || !selectedProviderId}
            onClick={() => refetchModels()}
            aria-label="Refresh models"
          >
            <RotateCw className="size-4" />
          </Button>
        </div>
      </Field>

      <Field className="space-y-1.5">
        <FieldLabel htmlFor="cs-model-input">Custom model ID</FieldLabel>
        <Input
          id="cs-model-input"
          value={modelInput}
          onChange={(e) => setModelInput(e.target.value)}
          onBlur={() => handleModelChange(modelInput)}
          placeholder="Or type model ID directly"
          disabled={isStreaming || !isAdmin}
        />
      </Field>

      <Field className="space-y-1.5">
        <FieldLabel htmlFor="cs-preset">Preset</FieldLabel>
        <Select
          value={selectedPresetId || "_none"}
          onValueChange={handlePresetChange}
          disabled={isStreaming}
        >
          <SelectTrigger id="cs-preset">
            <SelectValue placeholder="Default (no preset)" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="_none">None (default)</SelectItem>
              {presets?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
