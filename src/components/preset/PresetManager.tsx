import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
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
export function PresetManager({ variant = "page" }: { variant?: "page" | "sheet" } = {}) {
  const isSheet = variant === "sheet";
  const { data: providers = [] } = useAiProviders();
  const { data: userSettings } = useUserSettings();
  const updateDefaults = useUpdateUserSettings();
  const { data: presets = [], isLoading, error } = usePresets();
  const createPreset = useCreatePreset();
  const updatePreset = useUpdatePreset();
  const deletePreset = useDeletePreset();

  const [editing, setEditing] = useState<PresetListItem | "new" | null>(null);
  const [delPresetId, setDelPresetId] = useState<string | null>(null);
  const selectedPresetId = userSettings?.defaultPresetId ?? "";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorBanner message={error instanceof Error ? error.message : "Failed to load presets"} />
    );
  }

  return (
    <div className="space-y-6">
      {presets.length === 0 ? (
        <p className={`text-2 text-sm py-4 ${isSheet ? "text-(--sea-ink-soft)/70" : ""}`}>
          No presets configured yet.
        </p>
      ) : (
        <div className="space-y-2">
          {presets.map((p) => {
            const isDefault = p.id === selectedPresetId;
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
                    <div className="flex items-center gap-1.5">
                      <p className={`text-headline truncate ${isSheet ? "text-(--sea-ink)" : ""}`}>
                        {p.name}
                      </p>
                      {isDefault ? (
                        <Badge
                          variant="default"
                          className={`shrink-0 text-[10px] ${
                            isSheet ? "bg-(--lagoon)/15 text-(--lagoon) border-(--lagoon)/20" : ""
                          }`}
                        >
                          Default
                        </Badge>
                      ) : null}
                    </div>
                    <p
                      className={`text-3 text-xs font-mono ${isSheet ? "text-(--sea-ink-soft)/70" : ""}`}
                    >
                      {paramSummary(p)}
                    </p>
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
                                updateDefaults.mutate({
                                  defaultPresetId: p.id,
                                }),
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

      <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
        + Add preset
      </Button>

      <div className="space-y-1.5">
        <Label>Default preset</Label>
        <Select
          value={selectedPresetId || "_none"}
          onValueChange={(v) =>
            updateDefaults.mutate({
              defaultPresetId: v === "_none" ? null : v,
            })
          }
        >
          <SelectTrigger className="w-full" aria-label="Default preset">
            <SelectValue placeholder="Select preset" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="_none">— None —</SelectItem>
              {presets.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
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

      <ConfirmDialog
        open={delPresetId !== null}
        onOpenChange={(o) => !o && setDelPresetId(null)}
        title="Delete preset"
        description="This preset will be permanently deleted."
        destructive
        loading={deletePreset.isPending}
        onConfirm={() => {
          if (!delPresetId) return;
          deletePreset.mutate(
            { id: delPresetId },
            {
              onSuccess: () => {
                toast.success("Preset deleted");
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
