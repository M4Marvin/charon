import { useEffect, useState } from "react";
import { TriangleAlert, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useProviderModels } from "@/hooks/useProviderModels";

import type { AiProviderListItem } from "@/hooks/useAiProviders";
import type { PresetData, PresetListItem } from "@/hooks/usePresets";

interface PresetDialogProps {
  state: PresetListItem | "new" | null;
  providers: AiProviderListItem[];
  defaultModel: string;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    providerId?: string;
    model?: string;
    data: PresetData;
  }) => void;
  onUpdate: (input: {
    id: string;
    name?: string;
    providerId?: string | null;
    model?: string | null;
    data?: PresetData;
  }) => void;
}

export function PresetDialog({
  state,
  providers,
  defaultModel,
  onClose,
  onCreate,
  onUpdate,
}: PresetDialogProps) {
  const open = state !== null;
  const editing = state && state !== "new" ? state : null;
  const [name, setName] = useState("");
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.8);
  const [maxTokens, setMaxTokens] = useState(1200);
  const [topP, setTopP] = useState(1);
  const [contextSize, setContextSize] = useState(8192);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0);
  const [presencePenalty, setPresencePenalty] = useState(0);

  const {
    data: fetchedModels = [],
    isLoading: modelsLoading,
    error: modelsError,
    refetch: refetchModels,
  } = useProviderModels(providerId);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setProviderId(editing.providerId ?? "");
      setModel(editing.model ?? "");
      const d = editing.data as PresetData;
      setTemperature(d.temperature ?? 0.8);
      setMaxTokens(d.maxTokens ?? 1200);
      setTopP(d.topP ?? 1);
      setContextSize(d.contextSize ?? 8192);
      setFrequencyPenalty(d.frequencyPenalty ?? 0);
      setPresencePenalty(d.presencePenalty ?? 0);
    } else {
      setName("");
      setProviderId("");
      setModel(defaultModel);
      setTemperature(0.8);
      setMaxTokens(1200);
      setTopP(1);
      setContextSize(8192);
      setFrequencyPenalty(0);
      setPresencePenalty(0);
    }
  }, [editing, open, defaultModel]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit preset" : "New preset"}</DialogTitle>
          <DialogDescription>Generation parameters</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="pr-name">Name</Label>
            <Input id="pr-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Provider (optional)</Label>
            <Select
              value={providerId || "_none"}
              onValueChange={(v) => setProviderId(v === "_none" ? "" : v)}
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
          <div className="space-y-1">
            <Label>Model (optional)</Label>
            {providerId ? (
              <>
                <div className="flex gap-1.5">
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="flex-1">
                      <SelectValue
                        placeholder={
                          modelsLoading && fetchedModels.length === 0
                            ? "Loading models..."
                            : "Select model"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {fetchedModels.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.id}
                        </SelectItem>
                      ))}
                      {fetchedModels.length === 0 && !modelsLoading && !modelsError && (
                        <div className="text-muted-foreground px-3 py-2 text-xs">
                          No models found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
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
                </div>
                {modelsError && !modelsLoading && (
                  <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                    <TriangleAlert className="size-3 shrink-0" />
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
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Or type model ID"
                  className="mt-1"
                />
              </>
            ) : (
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="model id"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <Label>Temperature</Label>
                <p className="text-muted-foreground text-xs">
                  Higher = more creative, lower = more focused
                </p>
              </div>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {temperature.toFixed(1)}
              </span>
            </div>
            <Slider
              value={[temperature]}
              onValueChange={(v) => setTemperature(v[0]!)}
              min={0}
              max={2}
              step={0.1}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <Label>Top P</Label>
                <p className="text-muted-foreground text-xs">
                  Nucleus sampling. Lower = fewer token choices
                </p>
              </div>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {topP.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[topP]}
              onValueChange={(v) => setTopP(v[0]!)}
              min={0}
              max={1}
              step={0.05}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <Label>Max tokens</Label>
                <p className="text-muted-foreground text-xs">Maximum response length in tokens</p>
              </div>
              <Input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="w-24 text-right font-mono text-xs"
              />
            </div>
            <Slider
              value={[maxTokens]}
              onValueChange={(v) => setMaxTokens(v[0]!)}
              min={0}
              max={8192}
              step={16}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <Label>Context size</Label>
                <p className="text-muted-foreground text-xs">
                  Token budget for the prompt context window
                </p>
              </div>
              <Input
                type="number"
                value={contextSize}
                onChange={(e) => setContextSize(Number(e.target.value))}
                className="w-24 text-right font-mono text-xs"
              />
            </div>
            <Slider
              value={[contextSize]}
              onValueChange={(v) => setContextSize(v[0]!)}
              min={0}
              max={131072}
              step={512}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <Label>Frequency penalty</Label>
                <p className="text-muted-foreground text-xs">Discourages repeated tokens</p>
              </div>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {frequencyPenalty.toFixed(1)}
              </span>
            </div>
            <Slider
              value={[frequencyPenalty]}
              onValueChange={(v) => setFrequencyPenalty(v[0]!)}
              min={-2}
              max={2}
              step={0.1}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <Label>Presence penalty</Label>
                <p className="text-muted-foreground text-xs">Encourages new topics</p>
              </div>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {presencePenalty.toFixed(1)}
              </span>
            </div>
            <Slider
              value={[presencePenalty]}
              onValueChange={(v) => setPresencePenalty(v[0]!)}
              min={-2}
              max={2}
              step={0.1}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const data: PresetData = {
                temperature,
                topP,
                maxTokens,
                contextSize,
                frequencyPenalty,
                presencePenalty,
              };
              if (editing) {
                onUpdate({
                  id: editing.id,
                  name,
                  providerId: providerId || null,
                  model: model || null,
                  data,
                });
              } else {
                onCreate({
                  name,
                  providerId: providerId || undefined,
                  model: model || undefined,
                  data,
                });
              }
            }}
          >
            {editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
