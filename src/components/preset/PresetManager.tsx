import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { SkeletonRows } from "@/components/common/Skeletons";
import { EmptyState } from "@/components/common/EmptyState";
import { useAiProviders } from "@/hooks/useAiProviders";
import {
  usePresets,
  useCreatePreset,
  useUpdatePreset,
  useDeletePreset,
  type PresetListItem,
  type PresetData,
} from "@/hooks/usePresets";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/useUserSettings";
import { PresetDialog } from "@/components/preset/PresetDialog";

function paramSummary(p: PresetListItem): string {
  const d = p.data as PresetData;
  return (
    [
      d.temperature !== undefined && `temp ${d.temperature}`,
      d.topP !== undefined && `top_p ${d.topP}`,
      d.maxTokens !== undefined && `max ${d.maxTokens}`,
      d.contextSize !== undefined && `ctx ${d.contextSize}`,
    ]
      .filter(Boolean)
      .join(" · ") || "—"
  );
}

/**
 * Full preset management UI (list, create/edit/duplicate/delete, set default).
 * Shared by the /settings/presets route and the chat settings sheet so
 * management stays in sync.
 */
export function PresetManager() {
  const { data: providers = [] } = useAiProviders();
  const { data: userSettings, error: settingsError, refetch: refetchSettings } = useUserSettings();
  const updateDefaults = useUpdateUserSettings();
  const { data: presets = [], isLoading, error, refetch: refetchPresets } = usePresets();
  const createPreset = useCreatePreset();
  const updatePreset = useUpdatePreset();
  const deletePreset = useDeletePreset();

  const [editing, setEditing] = useState<PresetListItem | "new" | null>(null);
  const [delPresetId, setDelPresetId] = useState<string | null>(null);
  const selectedPresetId = userSettings?.defaultPresetId ?? "";

  if (isLoading) {
    return <SkeletonRows rows={3} />;
  }

  if (error || settingsError) {
    const failure = error ?? settingsError;
    return (
      <ErrorBanner
        message={
          failure instanceof Error
            ? `We couldn’t load your presets. ${failure.message}`
            : "We couldn’t load your presets."
        }
        onRetry={() => {
          void refetchPresets();
          void refetchSettings();
        }}
      />
    );
  }

  const deletingPreset = presets.find((p) => p.id === delPresetId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" className="h-10 px-3" onClick={() => setEditing("new")}>
          + Add preset
        </Button>
      </div>
      {presets.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No presets yet"
          description="Save generation parameters you reuse across chats."
        >
          <Button className="h-10" onClick={() => setEditing("new")}>
            Add preset
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {presets.map((p) => {
            const isDefault = p.id === selectedPresetId;
            return (
              <div
                key={p.id}
                className={`rounded-lg border p-4 ${
                  isDefault ? "border-brand/30 bg-brand/5" : "bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-headline truncate">{p.name}</p>
                      {isDefault ? (
                        <Badge variant="default" className="shrink-0 text-xs">
                          Default
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-2 text-xs font-mono">{paramSummary(p)}</p>
                  </div>
                  <RowActionsMenu
                    label={`Actions for ${p.name}`}
                    items={[
                      {
                        label: "Edit",
                        onSelect: () => setEditing(p),
                      },
                      {
                        label: "Duplicate",
                        onSelect: () => {
                          createPreset.mutate(
                            {
                              name: `${p.name} copy`,
                              providerId: p.providerId ?? undefined,
                              model: p.model ?? undefined,
                              data: p.data as PresetData,
                            },
                            {
                              onSuccess: () => toast.success("Preset duplicated"),
                              onError: (e) =>
                                toast.error(`Duplicate failed: ${(e as Error).message}`),
                            },
                          );
                        },
                      },
                      ...(!isDefault
                        ? [
                            {
                              label: "Set as default",
                              onSelect: () =>
                                updateDefaults.mutate(
                                  { defaultPresetId: p.id },
                                  {
                                    onError: (e) =>
                                      toast.error(`Update failed: ${(e as Error).message}`),
                                  },
                                ),
                            },
                          ]
                        : []),
                      {
                        label: "Delete",
                        destructive: true,
                        onSelect: () => setDelPresetId(p.id),
                      },
                    ]}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PresetDialog
        state={editing}
        pending={createPreset.isPending || updatePreset.isPending}
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

      <ConfirmDialog
        open={delPresetId !== null}
        onOpenChange={(o) => !o && setDelPresetId(null)}
        title={deletingPreset ? `Delete ${deletingPreset.name}?` : "Delete preset"}
        description={
          deletingPreset?.id === selectedPresetId
            ? "This is your default preset. It will be cleared, and chats will use their provider defaults."
            : "This preset will be permanently deleted."
        }
        destructive
        loading={deletePreset.isPending}
        onConfirm={() => {
          if (!delPresetId) return;
          deletePreset.mutate(
            { id: delPresetId },
            {
              onSuccess: (result) => {
                toast.success(
                  result.wasDefault
                    ? "Default preset deleted. Chats will use their provider defaults."
                    : "Preset deleted",
                );
                setDelPresetId(null);
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
