import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Cloud, Laptop, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusDot } from "@/components/common/StatusDot";
import { cn } from "@/lib/utils";
import {
  CATALOG_PROVIDERS,
  findCatalogProvider,
  formatContext,
  formatCost,
  type CatalogModel,
} from "@/lib/models-dev";
import { useCreateAiProvider } from "@/hooks/useAiProviders";
import { useUpdateUserSettings } from "@/hooks/useUserSettings";
import { probeProviderConfig } from "@/server/fns/models";

type ProbeState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

export function ProviderStep({ onCreated }: { onCreated: () => void }) {
  const initial = findCatalogProvider("openai");
  const [providerId, setProviderId] = useState(initial.id);
  const [name, setName] = useState(initial.name);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initial.models[0]?.id ?? "");
  const [models, setModels] = useState<CatalogModel[]>(initial.models);
  const [query, setQuery] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [probe, setProbe] = useState<ProbeState>({ status: "idle" });

  const createProvider = useCreateAiProvider();
  const updateDefaults = useUpdateUserSettings();
  const probeMutation = useMutation({
    mutationFn: (input: { baseUrl: string; apiKey: string }) =>
      probeProviderConfig({ data: input }),
  });

  const selected = findCatalogProvider(providerId);
  const keyRequired = selected.apiKeyRequired;
  const ready =
    name.trim().length > 0 &&
    baseUrl.trim().length > 0 &&
    model.trim().length > 0 &&
    (!keyRequired || apiKey.trim().length > 0);
  const filtered = models
    .filter((entry) =>
      `${entry.name} ${entry.id}`.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .slice(0, 40);

  function chooseProvider(id: string) {
    const provider = findCatalogProvider(id);
    setProviderId(provider.id);
    setName(provider.name);
    setBaseUrl(provider.baseUrl);
    setApiKey("");
    setModel(provider.models[0]?.id ?? "");
    setModels(provider.models);
    setQuery("");
    setAdvanced(provider.id === "custom");
    setProbe({ status: "idle" });
  }

  function detectModels() {
    if (!baseUrl.trim()) return;
    setProbe({ status: "testing" });
    probeMutation.mutate(
      { baseUrl: baseUrl.trim(), apiKey },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setProbe({ status: "error", message: result.error ?? "Could not reach the endpoint." });
            return;
          }
          const known = new Map(selected.models.map((entry) => [entry.id, entry]));
          const found = result.models.map(
            (entry): CatalogModel => known.get(entry.id) ?? { id: entry.id, name: entry.id },
          );
          setModels(found);
          if (!model && found[0]) setModel(found[0].id);
          setProbe({
            status: "ok",
            message: `${result.modelCount} models · ${result.latencyMs}ms`,
          });
        },
        onError: (error) => {
          setProbe({ status: "error", message: (error as Error).message });
        },
      },
    );
  }

  async function save(skipProbe = false) {
    if (!ready) return;
    setProbe({ status: "testing" });
    try {
      if (!skipProbe) {
        const result = await probeProviderConfig({ data: { baseUrl: baseUrl.trim(), apiKey } });
        if (!result.ok) {
          setProbe({ status: "error", message: result.error ?? "The endpoint did not answer." });
          return;
        }
        setProbe({
          status: "ok",
          message: `Connected · ${result.latencyMs}ms · ${result.modelCount} models`,
        });
      }
      const created = await createProvider.mutateAsync({
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        apiKey,
        ...(model.trim() ? { defaultModel: model.trim() } : {}),
      });
      await updateDefaults.mutateAsync({
        defaultProviderId: created.id,
        defaultSelectedModel: model.trim() || null,
        defaultPresetId: null,
      });
      toast.success("Provider connected");
      onCreated();
    } catch (error) {
      toast.error((error as Error).message || "Could not save the provider");
      setProbe({ status: "idle" });
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label>Choose a provider</Label>
        <div className="grid grid-cols-2 gap-2">
          {CATALOG_PROVIDERS.map((provider) => {
            const active = provider.id === providerId;
            const Icon = provider.local ? Laptop : Cloud;
            return (
              <button
                key={provider.id}
                type="button"
                aria-pressed={active}
                onClick={() => chooseProvider(provider.id)}
                className={cn(
                  "flex min-h-14 cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2",
                  active
                    ? "border-brand/60 bg-brand/10"
                    : "border-border bg-surface hover:bg-raised",
                )}
              >
                <Icon
                  className={cn("mt-0.5 size-4 shrink-0", active ? "text-brand" : "text-2")}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-1">{provider.name}</span>
                  <span className="block text-xs leading-snug text-2">{provider.hint}</span>
                </span>
                {active ? (
                  <Check className="ml-auto size-4 shrink-0 text-brand" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="provider-api-key">
          {keyRequired ? "API key" : "API key (usually not needed)"}
        </Label>
        <Input
          id="provider-api-key"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={
            keyRequired ? "Paste the key from your provider" : "Leave blank for a local model"
          }
          autoComplete="off"
        />
        <p className="text-2 text-xs">
          Stored encrypted on this machine. It is only sent to {name || "this provider"}.
        </p>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="provider-model">Model</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={detectModels}
            disabled={!baseUrl.trim() || probeMutation.isPending}
          >
            <RefreshCw
              className={cn("size-3.5", probeMutation.isPending && "animate-spin")}
              aria-hidden="true"
            />
            {selected.local ? "Detect models" : "Fetch models"}
          </Button>
        </div>
        <Input
          id="provider-model"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const typed = query.trim();
            if (typed) {
              setModel(typed);
              setQuery("");
              setProbe({ status: "idle" });
            }
          }}
          placeholder={model ? `Selected: ${model}` : "Search models, or type a model ID"}
          autoComplete="off"
        />
        <div className="max-h-44 overflow-auto rounded-xl border border-border bg-base">
          {filtered.length === 0 ? (
            <p className="text-2 text-xs p-3">
              No matching models. Press Enter to use the typed ID anyway.
            </p>
          ) : (
            filtered.map((entry) => {
              const active = entry.id === model;
              const context = formatContext(entry.context);
              const cost = formatCost(entry);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setModel(entry.id);
                    setQuery("");
                  }}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px]",
                    active ? "bg-brand/10" : "hover:bg-raised",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-1">{entry.name}</span>
                    <span className="block truncate text-xs text-2">
                      {[entry.id, context ? `${context} context` : null, cost]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {active ? (
                    <Check className="size-4 shrink-0 text-brand" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
        {model ? (
          <p className="text-2 text-xs">
            Selected: <span className="text-2">{model}</span>
          </p>
        ) : null}
      </div>

      <details
        className="rounded-xl border border-border bg-surface px-4 py-3"
        open={advanced}
        onToggle={(event) => setAdvanced((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-sm font-medium text-1">
          Advanced: endpoint and display name
        </summary>
        <div className="mt-4 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="provider-base-url">Base URL</Label>
            <Input
              id="provider-base-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.example.com/v1"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="provider-name">Display name</Label>
            <Input
              id="provider-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My provider"
            />
          </div>
          <p className="text-2 text-xs">
            Anthropic does not expose an OpenAI-compatible endpoint. Use a proxy and enter it here.
          </p>
        </div>
      </details>

      <div className="grid gap-2">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={!ready || createProvider.isPending}
        >
          {createProvider.isPending ? "Connecting..." : "Use this provider"}
        </Button>
        {probe.status === "testing" ? (
          <StatusDot tone="muted" label="Testing the connection..." />
        ) : null}
        {probe.status === "ok" ? <StatusDot tone="success" label={probe.message} /> : null}
        {probe.status === "error" ? (
          <div className="grid gap-2">
            <StatusDot tone="danger" label={probe.message} />
            <button
              type="button"
              onClick={() => void save(true)}
              className="cursor-pointer justify-self-start text-xs text-2 underline underline-offset-4 hover:text-1"
            >
              Save without testing
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
