import { useState, useCallback } from "react";
import { CircleCheck, CircleX, Zap } from "lucide-react";
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
import { getSaveState, useSettingsSaveStatus } from "@/features/chat/ui/settings/save-status";
import { useAiProviders, useTestProviderConnection } from "@/hooks/useAiProviders";
import { usePresets } from "@/hooks/usePresets";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/useUserSettings";

export function ModelDefaultsFields() {
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
  const retrySave = updateUserSettings.variables
    ? () => updateUserSettings.mutate(updateUserSettings.variables!)
    : undefined;
  useSettingsSaveStatus("model", getSaveState(updateUserSettings), {
    retry: retrySave,
    at: updateUserSettings.submittedAt,
    error: updateUserSettings.error,
  });

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
            <SelectTrigger id="cs-provider" className="h-10! min-w-0 flex-1 max-sm:h-11!">
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
            className="h-10 shrink-0 gap-1.5 px-3 max-sm:h-11"
            disabled={!selectedProviderId || testConnection.isPending}
            onClick={handleTest}
          >
            {testConnection.isPending ? (
              <Spinner className="size-3.5" />
            ) : (
              <Zap className="size-3.5" />
            )}
            Test
          </Button>
        </div>
      </Field>

      {testResult ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-subtle bg-surface/60 px-3 py-2.5 text-xs"
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
      ) : null}

      <Field className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor="cs-model">Model</FieldLabel>
          {selectedModel ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-8 px-2 text-xs text-2 hover:text-1"
              onClick={handleClearModel}
            >
              Clear
            </Button>
          ) : null}
        </div>
        <ModelCombobox
          id="cs-model"
          providerId={selectedProviderId}
          value={selectedModel}
          onChange={handleModelChange}
          disabled={!selectedProviderId}
          ariaLabel="Default model"
        />
        {!selectedModel && selectedProviderId ? (
          <p className="text-xs text-2">Pick a model for this provider.</p>
        ) : null}
      </Field>

      <Field className="space-y-1.5">
        <FieldLabel htmlFor="cs-preset">Preset</FieldLabel>
        <Select value={selectedPresetId || "_none"} onValueChange={handlePresetChange}>
          <SelectTrigger id="cs-preset" className="h-10! w-full max-sm:h-11!">
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
