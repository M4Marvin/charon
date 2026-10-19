import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { StatusDot } from "@/components/common/StatusDot";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { Spinner } from "@/components/ui/spinner";
import {
  useAiProviders,
  useCreateAiProvider,
  useDeleteAiProvider,
  useUpdateAiProvider,
  useTestProviderConnection,
  type AiProviderListItem,
} from "@/hooks/useAiProviders";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/useUserSettings";
import { ProviderDialog } from "@/components/ai/ProviderDialog";
import { TestMessageDialog } from "@/components/ai/TestMessageDialog";
import type { ProbeResult } from "@/server/fns/models";

export function ProviderManager() {
  const {
    data: userSettings,
    isLoading: settingsLoading,
    error: settingsError,
    refetch: refetchSettings,
  } = useUserSettings();
  const updateDefaults = useUpdateUserSettings();
  const {
    data: providers = [],
    isLoading: providersLoading,
    error: providersError,
    refetch: refetchProviders,
  } = useAiProviders();
  const createProvider = useCreateAiProvider();
  const updateProvider = useUpdateAiProvider();
  const deleteProvider = useDeleteAiProvider();
  const testConnection = useTestProviderConnection();

  const defaultProviderId = userSettings?.defaultProviderId ?? "";
  const [editingProvider, setEditingProvider] = useState<AiProviderListItem | "new" | null>(null);
  const [delProviderId, setDelProviderId] = useState<string | null>(null);
  const [pendingDefaultProviderId, setPendingDefaultProviderId] = useState<string | null>(null);
  const [testMsgProvider, setTestMsgProvider] = useState<AiProviderListItem | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ProbeResult | null>>({});

  const handleTest = async (providerId: string) => {
    if (testingId) return;
    setTestingId(providerId);
    try {
      const result = await testConnection.mutateAsync(providerId);
      setTestResults((prev) => ({ ...prev, [providerId]: result }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestingId(null);
    }
  };

  const isLoading = settingsLoading || providersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner label="Loading providers" />
      </div>
    );
  }

  if (providersError || settingsError) {
    const failure = providersError ?? settingsError;
    return (
      <ErrorBanner
        message={failure instanceof Error ? failure.message : "Failed to load providers"}
        onRetry={() => {
          void refetchProviders();
          void refetchSettings();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {providers.length === 0 ? (
        <p className="text-2 text-sm py-4">No providers configured yet.</p>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => {
            const testResult = testResults[p.id];
            const isDefault = p.id === defaultProviderId;
            return (
              <div
                key={p.id}
                className={`rounded-lg border p-4 ${
                  isDefault ? "border-brand/30 bg-brand/5" : "bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-headline">{p.name}</span>
                      {isDefault ? (
                        <Badge variant="default" className="shrink-0 text-xs">
                          Default
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex min-w-0 items-center gap-2 text-xs text-2">
                      {testingId === p.id ? (
                        <StatusDot tone="muted" label="Testing…" />
                      ) : testResult ? (
                        testResult.ok ? (
                          <StatusDot tone="success" label="Connected" />
                        ) : (
                          <StatusDot tone="danger" label="Error" />
                        )
                      ) : (
                        <StatusDot tone="muted" label="Untested" />
                      )}
                      <span className="truncate font-mono">{p.baseUrl}</span>
                    </div>
                    {testResult && testResult.ok ? (
                      <p className="text-3 text-xs">
                        {testResult.latencyMs}ms · {testResult.modelCount} models
                      </p>
                    ) : null}
                    {testResult && !testResult.ok && testResult.error ? (
                      <p className="text-danger text-xs">{testResult.error}</p>
                    ) : null}
                  </div>
                  <RowActionsMenu
                    label={`Actions for ${p.name}`}
                    items={[
                      {
                        label: "Edit",
                        onSelect: () => setEditingProvider(p),
                      },
                      {
                        label: "Test connection",
                        onSelect: () => handleTest(p.id),
                      },
                      {
                        label: "Test message",
                        onSelect: () => setTestMsgProvider(p),
                      },
                      ...(!isDefault
                        ? [
                            {
                              label: "Set as default",
                              onSelect: () => setPendingDefaultProviderId(p.id),
                            },
                          ]
                        : []),
                      {
                        label: "Delete",
                        destructive: true,
                        onSelect: () => setDelProviderId(p.id),
                      },
                    ]}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={() => setEditingProvider("new")}>
        + Add provider
      </Button>

      <ProviderDialog
        state={editingProvider}
        onClose={() => setEditingProvider(null)}
        pending={createProvider.isPending || updateProvider.isPending}
        onCreate={(input) =>
          createProvider.mutate(input, {
            onSuccess: ({ id }) => {
              toast.success("Provider created");
              setEditingProvider(null);
              updateDefaults.mutate(
                {
                  defaultProviderId: id,
                  defaultSelectedModel: null,
                  defaultPresetId: null,
                },
                { onError: (e) => toast.error(`Default update failed: ${(e as Error).message}`) },
              );
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

      <TestMessageDialog provider={testMsgProvider} onClose={() => setTestMsgProvider(null)} />

      <ConfirmDialog
        open={pendingDefaultProviderId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDefaultProviderId(null);
        }}
        title="Set default provider?"
        description="This clears the default model and preset for all chats. Choose a new model in AI defaults after switching."
        confirmLabel="Set default"
        loadingLabel="Saving…"
        loading={updateDefaults.isPending}
        onConfirm={() => {
          if (!pendingDefaultProviderId) return;
          updateDefaults.mutate(
            {
              defaultProviderId: pendingDefaultProviderId,
              defaultSelectedModel: null,
              defaultPresetId: null,
            },
            { onError: (e) => toast.error(`Update failed: ${(e as Error).message}`) },
          );
          setPendingDefaultProviderId(null);
        }}
      />

      <ConfirmDialog
        open={delProviderId !== null}
        onOpenChange={(o) => !o && setDelProviderId(null)}
        title="Delete provider"
        description="This provider will be permanently removed. Settings referencing it will need to be updated."
        destructive
        loading={deleteProvider.isPending}
        onConfirm={() => {
          if (!delProviderId) return;
          deleteProvider.mutate(
            { id: delProviderId },
            {
              onSuccess: () => {
                toast.success("Provider deleted");
                setDelProviderId(null);
                setTestResults((prev) => {
                  const next = { ...prev };
                  delete next[delProviderId!];
                  return next;
                });
              },
              onError: (err) =>
                toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`),
            },
          );
        }}
      />
    </div>
  );
}
