import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { StatusDot } from "@/components/common/StatusDot";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { ModelCombobox } from "@/components/common/ModelCombobox";
import { Label } from "@/components/ui/label";
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

/**
 * Full provider management UI (list, add/edit/delete, test connection,
 * test message, set default, default model). Shared by the /settings/providers
 * route and the chat settings sheet so management stays in sync.
 */
export function ProviderManager({ variant = "page" }: { variant?: "page" | "sheet" } = {}) {
  const isSheet = variant === "sheet";
  const { data: userSettings, isLoading: settingsLoading } = useUserSettings();
  const updateDefaults = useUpdateUserSettings();
  const { data: providers = [], isLoading: providersLoading, error } = useAiProviders();
  const createProvider = useCreateAiProvider();
  const updateProvider = useUpdateAiProvider();
  const deleteProvider = useDeleteAiProvider();
  const testConnection = useTestProviderConnection();

  const defaultProviderId = userSettings?.defaultProviderId ?? "";
  const [editingProvider, setEditingProvider] = useState<AiProviderListItem | "new" | null>(null);
  const [delProviderId, setDelProviderId] = useState<string | null>(null);
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
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorBanner message={error instanceof Error ? error.message : "Failed to load providers"} />
    );
  }

  return (
    <div className="space-y-6">
      {providers.length === 0 ? (
        <p className={`text-2 text-sm py-4 ${isSheet ? "text-(--sea-ink-soft)/70" : ""}`}>
          No providers configured yet.
        </p>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => {
            const testResult = testResults[p.id];
            const isDefault = p.id === defaultProviderId;
            return (
              <div
                key={p.id}
                className={`rounded-lg border p-4 ${
                  isSheet
                    ? isDefault
                      ? "border-(--lagoon)/30 bg-(--lagoon)/5"
                      : "bg-white/5"
                    : isDefault
                      ? "border-brand/30 bg-brand/5"
                      : "bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
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
                      <span
                        className={`text-headline truncate ${isSheet ? "text-(--sea-ink)" : ""}`}
                      >
                        {p.name}
                      </span>
                      {isDefault ? (
                        <Badge
                          variant="default"
                          className={`text-[10px] ml-1 ${
                            isSheet ? "bg-(--lagoon)/15 text-(--lagoon) border-(--lagoon)/20" : ""
                          }`}
                        >
                          Default
                        </Badge>
                      ) : null}
                    </div>
                    <p
                      className={`text-2 text-xs font-mono truncate ${
                        isSheet ? "text-(--sea-ink-soft)" : ""
                      }`}
                    >
                      {p.baseUrl}
                    </p>
                    {testResult && testResult.ok ? (
                      <p className={`text-3 text-xs ${isSheet ? "text-(--sea-ink-soft)/70" : ""}`}>
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
                              onSelect: () =>
                                updateDefaults.mutate({
                                  defaultProviderId: p.id,
                                  defaultSelectedModel: null,
                                  defaultPresetId: null,
                                }),
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

      {defaultProviderId ? (
        <div className="space-y-1.5">
          <Label>Default model</Label>
          <ModelCombobox
            providerId={defaultProviderId}
            value={userSettings?.defaultSelectedModel ?? ""}
            onChange={(model) => updateDefaults.mutate({ defaultSelectedModel: model || null })}
            aria-label="Default model"
          />
        </div>
      ) : null}

      <ProviderDialog
        state={editingProvider}
        onClose={() => setEditingProvider(null)}
        pending={createProvider.isPending || updateProvider.isPending}
        onCreate={(input) =>
          createProvider.mutate(input, {
            onSuccess: ({ id }) => {
              toast.success("Provider created");
              setEditingProvider(null);
              updateDefaults.mutate({
                defaultProviderId: id,
                defaultSelectedModel: null,
                defaultPresetId: null,
              });
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
