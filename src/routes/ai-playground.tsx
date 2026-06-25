import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useChat, fetchServerSentEvents } from "@tanstack/ai-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAiProviders,
  useCreateAiProvider,
  useDeleteAiProvider,
  useUpdateAiProvider,
} from "@/hooks/useAiProviders";
import {
  useCreatePreset,
  useDeletePreset,
  usePresets,
  useUpdatePreset,
  type PresetData,
} from "@/hooks/usePresets";
import { useProviderModels } from "@/hooks/useProviderModels";
import type { AiProviderListItem } from "@/hooks/useAiProviders";
import type { PresetListItem } from "@/hooks/usePresets";

export const Route = createFileRoute("/ai-playground")({
  component: AiPlaygroundPage,
});

function AiPlaygroundPage() {
  const { data: providers = [], isLoading: providersLoading } = useAiProviders();
  const { data: presets = [], isLoading: presetsLoading } = usePresets();

  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState<string>("");

  useEffect(() => {
    if (!selectedProviderId && providers[0]) {
      setSelectedProviderId(providers[0].id);
    }
  }, [providers, selectedProviderId]);

  useEffect(() => {
    setSelectedModel("");
  }, [selectedProviderId]);

  const {
    data: models = [],
    isFetching: modelsLoading,
    error: modelsError,
  } = useProviderModels(selectedProviderId);

  useEffect(() => {
    if (modelsError) toast.error(`Failed to fetch models: ${(modelsError as Error).message}`);
  }, [modelsError]);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId) ?? null,
    [providers, selectedProviderId],
  );

  useEffect(() => {
    if (selectedProvider?.defaultModel) {
      setSelectedModel(selectedProvider.defaultModel);
    } else if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0]!.id);
    }
  }, [selectedProvider, models, selectedModel]);

  useEffect(() => {
    if (!selectedPresetId) return;
    const preset = presets.find((p) => p.id === selectedPresetId);
    if (!preset) return;
    if (preset.model) setSelectedModel(preset.model);
    const data = preset.data as PresetData;
    setSystemPrompt(data.systemPrompt ?? "");
  }, [selectedPresetId, presets]);

  const canSend = selectedProviderId.length > 0 && selectedModel.length > 0;

  const bodyRef = useRef<{
    providerId: string;
    model: string;
    presetId: string;
    systemPrompt: string;
  }>({ providerId: "", model: "", presetId: "", systemPrompt: "" });
  bodyRef.current = {
    providerId: selectedProviderId,
    model: selectedModel,
    presetId: selectedPresetId,
    systemPrompt,
  };

  const connection = useMemo(
    () => fetchServerSentEvents("/api/chat", () => ({ body: bodyRef.current })),
    [],
  );

  const { messages, sendMessage, isLoading, stop, error, clear } = useChat({
    connection,
  });

  useEffect(() => {
    if (error) toast.error(`Chat error: ${(error as Error).message}`);
  }, [error]);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !canSend || isLoading) return;
    setInput("");
    void sendMessage(trimmed);
  };

  return (
    <div className="flex h-dvh">
      <aside className="w-80 shrink-0 overflow-y-auto border-r p-4">
        <h2 className="mb-3 text-sm font-semibold">Settings</h2>

        <ProvidersSection
          providers={providers}
          loading={providersLoading}
          selectedId={selectedProviderId}
          onSelect={setSelectedProviderId}
        />

        <Separator className="my-4" />

        <ModelSection
          provider={selectedProvider}
          models={models}
          loading={modelsLoading}
          selectedModel={selectedModel}
          onSelect={setSelectedModel}
          canFetch={Boolean(selectedProviderId)}
        />

        <Separator className="my-4" />

        <PresetsSection
          presets={presets}
          loading={presetsLoading}
          selectedId={selectedPresetId}
          onSelect={setSelectedPresetId}
          providers={providers}
          models={models}
          defaultModel={selectedModel}
        />

        <Separator className="my-4" />

        <SystemPromptSection value={systemPrompt} onChange={setSystemPrompt} />
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-medium">AI Playground</p>
            <p className="text-muted-foreground text-xs">
              {selectedProvider
                ? `${selectedProvider.name} · ${selectedModel || "no model"}`
                : "No provider configured"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && (
              <Button size="sm" variant="outline" onClick={() => stop()}>
                Stop
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => clear()}
              disabled={messages.length === 0}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground text-sm">
                {canSend ? "Send a message to start." : "Add a provider to start."}
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}
                >
                  <p className="text-muted-foreground mb-1 text-xs">
                    {m.role === "user" ? "You" : "Assistant"}
                  </p>
                  {m.parts.map((part, i) => {
                    if (part.type === "text")
                      return (
                        <p key={i} className="whitespace-pre-wrap">
                          {part.content}
                        </p>
                      );
                    return null;
                  })}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex shrink-0 items-end gap-2 border-t p-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              canSend ? "Type a message..." : "Add a provider and select a model to start"
            }
            className="min-h-[40px] flex-1 resize-none"
            rows={1}
            disabled={!canSend || isLoading}
          />
          <Button onClick={handleSend} disabled={!canSend || isLoading || !input.trim()}>
            {isLoading ? "..." : "Send"}
          </Button>
        </div>
      </main>
    </div>
  );
}

function ProvidersSection({
  providers,
  loading,
  selectedId,
  onSelect,
}: {
  providers: AiProviderListItem[];
  loading: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [editing, setEditing] = useState<AiProviderListItem | "new" | null>(null);
  const create = useCreateAiProvider();
  const update = useUpdateAiProvider();
  const remove = useDeleteAiProvider();

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Provider</Label>
        <Button size="sm" variant="ghost" onClick={() => setEditing("new")}>
          + Add
        </Button>
      </div>
      <Select value={selectedId} onValueChange={onSelect}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={loading ? "Loading..." : "Select provider"} />
        </SelectTrigger>
        <SelectContent>
          {providers.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
          {providers.length === 0 && !loading && (
            <div className="text-muted-foreground px-3 py-2 text-xs">No providers</div>
          )}
        </SelectContent>
      </Select>
      {selectedId && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const p = providers.find((x) => x.id === selectedId);
              if (p) setEditing(p);
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!window.confirm("Delete this provider?")) return;
              const p = providers.find((x) => x.id === selectedId);
              if (!p) return;
              remove.mutate(
                { id: p.id },
                {
                  onSuccess: () => {
                    toast.success("Provider deleted");
                    onSelect("");
                  },
                  onError: (e) => toast.error(`Delete failed: ${(e as Error).message}`),
                },
              );
            }}
          >
            Delete
          </Button>
        </div>
      )}
      <ProviderDialog
        state={editing}
        onClose={() => setEditing(null)}
        onCreate={(input) =>
          create.mutate(input, {
            onSuccess: (res) => {
              toast.success("Provider created");
              onSelect(res.id);
              setEditing(null);
            },
            onError: (e) => toast.error(`Create failed: ${(e as Error).message}`),
          })
        }
        onUpdate={(input) =>
          update.mutate(input, {
            onSuccess: () => {
              toast.success("Provider updated");
              setEditing(null);
            },
            onError: (e) => toast.error(`Update failed: ${(e as Error).message}`),
          })
        }
      />
    </section>
  );
}

function ProviderDialog({
  state,
  onClose,
  onCreate,
  onUpdate,
}: {
  state: AiProviderListItem | "new" | null;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    baseUrl: string;
    apiKey: string;
    defaultModel?: string;
    defaultHeaders?: Record<string, string>;
  }) => void;
  onUpdate: (input: {
    id: string;
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    defaultModel?: string | null;
    defaultHeaders?: Record<string, string> | null;
  }) => void;
}) {
  const open = state !== null;
  const editing = state && state !== "new" ? state : null;
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [headersText, setHeadersText] = useState("");

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setBaseUrl(editing.baseUrl);
      setApiKey(editing.apiKey);
      setDefaultModel(editing.defaultModel ?? "");
      setHeadersText(editing.defaultHeaders ? JSON.stringify(editing.defaultHeaders, null, 2) : "");
    } else {
      setName("");
      setBaseUrl("");
      setApiKey("");
      setDefaultModel("");
      setHeadersText("");
    }
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit provider" : "New provider"}</DialogTitle>
          <DialogDescription>OpenAI-compatible API endpoint</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-url">Base URL</Label>
            <Input
              id="p-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-key">API key</Label>
            <Input
              id="p-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-model">Default model (optional)</Label>
            <Input
              id="p-model"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-headers">Default headers JSON (optional)</Label>
            <Textarea
              id="p-headers"
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
              placeholder='{"X-Header": "value"}'
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              let defaultHeaders: Record<string, string> | undefined;
              if (headersText.trim()) {
                try {
                  defaultHeaders = JSON.parse(headersText) as Record<string, string>;
                } catch {
                  toast.error("Headers must be valid JSON");
                  return;
                }
              }
              if (editing) {
                onUpdate({
                  id: editing.id,
                  name,
                  baseUrl,
                  apiKey,
                  defaultModel: defaultModel || null,
                  defaultHeaders: defaultHeaders ?? null,
                });
              } else {
                onCreate({
                  name,
                  baseUrl,
                  apiKey,
                  ...(defaultModel ? { defaultModel } : {}),
                  ...(defaultHeaders ? { defaultHeaders } : {}),
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

function ModelSection({
  provider,
  models,
  loading,
  selectedModel,
  onSelect,
  canFetch,
}: {
  provider: AiProviderListItem | null;
  models: { id: string }[];
  loading: boolean;
  selectedModel: string;
  onSelect: (id: string) => void;
  canFetch: boolean;
}) {
  return (
    <section className="space-y-2">
      <Label className="text-xs">Model</Label>
      {provider?.defaultModel && !models.some((m) => m.id === selectedModel) ? (
        <Input
          value={selectedModel}
          onChange={(e) => onSelect(e.target.value)}
          placeholder="model id"
        />
      ) : (
        <Select value={selectedModel} onValueChange={onSelect} disabled={!canFetch}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={loading ? "Loading models..." : "Select model"} />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.id}
              </SelectItem>
            ))}
            {!loading && models.length === 0 && (
              <div className="text-muted-foreground px-3 py-2 text-xs">
                No models (set a default model on the provider)
              </div>
            )}
          </SelectContent>
        </Select>
      )}
    </section>
  );
}

function PresetsSection({
  presets,
  loading,
  selectedId,
  onSelect,
  providers,
  models,
  defaultModel,
}: {
  presets: PresetListItem[];
  loading: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  providers: AiProviderListItem[];
  models: { id: string }[];
  defaultModel: string;
}) {
  const [editing, setEditing] = useState<PresetListItem | "new" | null>(null);
  const create = useCreatePreset();
  const update = useUpdatePreset();
  const remove = useDeletePreset();

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Preset</Label>
        <Button size="sm" variant="ghost" onClick={() => setEditing("new")}>
          + Add
        </Button>
      </div>
      <Select value={selectedId || "_none"} onValueChange={(v) => onSelect(v === "_none" ? "" : v)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={loading ? "Loading..." : "Select preset"} />
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
      {selectedId && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const p = presets.find((x) => x.id === selectedId);
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
              remove.mutate(
                { id: selectedId },
                {
                  onSuccess: () => {
                    toast.success("Preset deleted");
                    onSelect("");
                  },
                  onError: (e) => toast.error(`Delete failed: ${(e as Error).message}`),
                },
              );
            }}
          >
            Delete
          </Button>
        </div>
      )}
      <PresetDialog
        state={editing}
        providers={providers}
        models={models}
        defaultModel={defaultModel}
        onClose={() => setEditing(null)}
        onCreate={(input) =>
          create.mutate(input, {
            onSuccess: () => {
              toast.success("Preset created");
              setEditing(null);
            },
            onError: (e) => toast.error(`Create failed: ${(e as Error).message}`),
          })
        }
        onUpdate={(input) =>
          update.mutate(input, {
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

function PresetDialog({
  state,
  providers,
  models,
  defaultModel,
  onClose,
  onCreate,
  onUpdate,
}: {
  state: PresetListItem | "new" | null;
  providers: AiProviderListItem[];
  models: { id: string }[];
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
}) {
  const open = state !== null;
  const editing = state && state !== "new" ? state : null;
  const [name, setName] = useState("");
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState("0.7");
  const [maxTokens, setMaxTokens] = useState("1024");
  const [topP, setTopP] = useState("1");
  const [contextSize, setContextSize] = useState("");
  const [frequencyPenalty, setFrequencyPenalty] = useState("0");
  const [presencePenalty, setPresencePenalty] = useState("0");

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setProviderId(editing.providerId ?? "");
      setModel(editing.model ?? "");
      const d = editing.data as PresetData;
      setSystemPrompt(d.systemPrompt ?? "");
      setTemperature(d.temperature?.toString() ?? "0.7");
      setMaxTokens(d.maxTokens?.toString() ?? "1024");
      setTopP(d.topP?.toString() ?? "1");
      setContextSize(d.contextSize?.toString() ?? "");
      setFrequencyPenalty(d.frequencyPenalty?.toString() ?? "0");
      setPresencePenalty(d.presencePenalty?.toString() ?? "0");
    } else {
      setName("");
      setProviderId("");
      setModel(defaultModel);
      setSystemPrompt("");
      setTemperature("0.7");
      setMaxTokens("1024");
      setTopP("1");
      setContextSize("");
      setFrequencyPenalty("0");
      setPresencePenalty("0");
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
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="model id"
            />
            {models.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Available: {models.map((m) => m.id).join(", ")}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label>System prompt</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label>Temperature</Label>
              <Input value={temperature} onChange={(e) => setTemperature(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Max tokens</Label>
              <Input value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Top P</Label>
              <Input value={topP} onChange={(e) => setTopP(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label>Context size</Label>
              <Input
                value={contextSize}
                onChange={(e) => setContextSize(e.target.value)}
                placeholder="tokens"
                type="number"
                min="0"
              />
            </div>
            <div className="space-y-1">
              <Label>Freq. penalty</Label>
              <Input
                value={frequencyPenalty}
                onChange={(e) => setFrequencyPenalty(e.target.value)}
                type="number"
                step="0.1"
                min="-2"
                max="2"
              />
            </div>
            <div className="space-y-1">
              <Label>Presence penalty</Label>
              <Input
                value={presencePenalty}
                onChange={(e) => setPresencePenalty(e.target.value)}
                type="number"
                step="0.1"
                min="-2"
                max="2"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const data: PresetData = {};
              if (systemPrompt) data.systemPrompt = systemPrompt;
              const t = parseFloat(temperature);
              if (!Number.isNaN(t)) data.temperature = t;
              const m = parseInt(maxTokens, 10);
              if (!Number.isNaN(m)) data.maxTokens = m;
              const p = parseFloat(topP);
              if (!Number.isNaN(p)) data.topP = p;
              const cs = parseInt(contextSize, 10);
              if (!Number.isNaN(cs) && cs > 0) data.contextSize = cs;
              const fp = parseFloat(frequencyPenalty);
              if (!Number.isNaN(fp)) data.frequencyPenalty = fp;
              const pp = parseFloat(presencePenalty);
              if (!Number.isNaN(pp)) data.presencePenalty = pp;
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

function SystemPromptSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <section className="space-y-2">
      <Label className="text-xs">System prompt (overrides preset)</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="You are a helpful assistant."
      />
    </section>
  );
}
