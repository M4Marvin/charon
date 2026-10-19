import { useState, useCallback } from "react";
import { Zap, ArrowUpRight, CircleCheck, CircleX } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldLabel } from "@/components/ui/field";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ModelCombobox } from "@/components/common/ModelCombobox";
import { SkeletonText } from "@/components/common/Skeletons";
import { SectionHeader } from "../section-header";
import { SaveStatus, getSaveState } from "../save-status";
import { useAiProviders, useTestProviderConnection } from "@/hooks/useAiProviders";
import { usePresets } from "@/hooks/usePresets";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/useUserSettings";

interface SectionProps {
  chatId: string;
  onClose: () => void;
}

export function ModelSection({ onClose }: SectionProps) {
  const {
    data: settings,
    error: settingsError,
    refetch: refetchSettings,
    isLoading: settingsLoading,
  } = useUserSettings();
  const {
    data: providers,
    error: providersError,
    refetch: refetchProviders,
    isLoading: providersLoading,
  } = useAiProviders();
  const {
    data: presets,
    error: presetsError,
    refetch: refetchPresets,
    isLoading: presetsLoading,
  } = usePresets();
  const updateUserSettings = useUpdateUserSettings();
  const testConnection = useTestProviderConnection();
  const saveState = getSaveState(updateUserSettings);
  const retrySave = updateUserSettings.variables
    ? () => updateUserSettings.mutate(updateUserSettings.variables!)
    : undefined;

  const queryError = settingsError ?? providersError ?? presetsError;
  const settingsQueryLoading = settingsLoading || providersLoading || presetsLoading;

  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latencyMs: number;
    modelCount: number;
    error?: string;
  } | null>(null);
  const [pendingProviderId, setPendingProviderId] = useState<string | null>(null);

  const selectedProviderId = settings?.defaultProviderId ?? "";
  const selectedModel = settings?.defaultSelectedModel ?? "";
  const selectedPresetId = settings?.defaultPresetId ?? "";

  const applyProviderChange = useCallback(
    (providerId: string) => {
      updateUserSettings.mutate({
        defaultProviderId: providerId,
        defaultSelectedModel: null,
        defaultPresetId: null,
      });
      setTestResult(null);
    },
    [updateUserSettings],
  );

  const handleProviderChange = useCallback(
    (providerId: string) => {
      if (providerId === selectedProviderId) return;
      if (selectedModel || selectedPresetId) {
        setPendingProviderId(providerId);
        return;
      }
      applyProviderChange(providerId);
    },
    [selectedProviderId, selectedModel, selectedPresetId, applyProviderChange],
  );

  const handleModelChange = useCallback(
    (model: string) => {
      const value = model.trim();
      if (!value || value === selectedModel) return;
      updateUserSettings.mutate({ defaultSelectedModel: value });
    },
    [selectedModel, updateUserSettings],
  );

  const handleClearModel = useCallback(() => {
    updateUserSettings.mutate({ defaultSelectedModel: null });
  }, [updateUserSettings]);

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
      <SectionHeader
        title="Model & preset"
        description="The default provider, model, and preset used by every chat."
        scope="global"
      />
      <SaveStatus state={saveState} error={updateUserSettings.error} onRetry={retrySave} />

      {queryError ? (
        <ErrorBanner
          message={
            queryError instanceof Error ? queryError.message : "Failed to load model settings"
          }
          onRetry={() => {
            void Promise.all([refetchSettings(), refetchProviders(), refetchPresets()]);
          }}
        />
      ) : null}

      {!queryError && settingsQueryLoading ? (
        <div role="status" className="space-y-2">
          <SkeletonText lines={3} />
          <span className="sr-only">Loading model settings</span>
        </div>
      ) : null}

      <Field className="space-y-1.5">
        <FieldLabel htmlFor="cs-provider">Provider</FieldLabel>
        <div className="flex gap-2">
          <Select
            value={selectedProviderId}
            onValueChange={handleProviderChange}
            disabled={settingsQueryLoading}
          >
            <SelectTrigger id="cs-provider" className="min-w-0 flex-1">
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
            disabled={!selectedProviderId || testConnection.isPending}
            onClick={handleTest}
            aria-label="Test provider connection"
          >
            {testConnection.isPending ? <Spinner className="size-4" /> : <Zap className="size-4" />}
          </Button>
        </div>
      </Field>

      {testResult && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-subtle px-3 py-2 text-xs"
        >
          {testResult.ok ? (
            <>
              <CircleCheck className="size-4 shrink-0 text-success" aria-hidden />
              <span className="text-success">
                Connected — {testResult.latencyMs}ms, {testResult.modelCount} models
              </span>
            </>
          ) : (
            <>
              <CircleX className="size-4 shrink-0 text-danger" aria-hidden />
              <span className="text-danger">
                Failed{testResult.error ? `: ${testResult.error}` : ""}
              </span>
            </>
          )}
        </div>
      )}

      <Field className="space-y-1.5">
        <FieldLabel htmlFor="cs-model">Model</FieldLabel>
        <ModelCombobox
          id="cs-model"
          providerId={selectedProviderId}
          value={selectedModel}
          onChange={handleModelChange}
          disabled={!selectedProviderId}
          ariaLabel="Default model"
        />
        {selectedModel ? (
          <div className="flex">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto w-fit p-0 text-xs text-2"
              onClick={handleClearModel}
            >
              Clear model
            </Button>
          </div>
        ) : null}
      </Field>

      <Field className="space-y-1.5">
        <FieldLabel htmlFor="cs-preset">Preset</FieldLabel>
        <Select value={selectedPresetId || "_none"} onValueChange={handlePresetChange}>
          <SelectTrigger id="cs-preset">
            <SelectValue placeholder="No preset" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="_none">No preset</SelectItem>
              {presets?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <div className="rounded-xl border border-subtle bg-surface p-4">
        <p className="text-sm font-medium text-1">Manage AI setup</p>
        <p className="mt-1 text-xs text-2">Providers and presets are shared across all chats.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" asChild>
            <Link to="/settings/providers" onClick={onClose}>
              Providers
              <ArrowUpRight className="size-3.5" data-icon="inline-end" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" asChild>
            <Link to="/settings/presets" onClick={onClose}>
              Presets
              <ArrowUpRight className="size-3.5" data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={pendingProviderId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingProviderId(null);
        }}
        title="Change provider?"
        description="This clears the default model and preset for all chats. You can choose a new model after switching."
        confirmLabel="Change provider"
        loadingLabel="Changing…"
        loading={updateUserSettings.isPending}
        onConfirm={() => {
          if (pendingProviderId) {
            applyProviderChange(pendingProviderId);
            setPendingProviderId(null);
          }
        }}
      />
    </div>
  );
}
