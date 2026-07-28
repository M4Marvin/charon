import { useState, useRef, useEffect } from "react";
import { Search, RotateCw, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useProviderModels } from "@/hooks/useProviderModels";

interface ModelComboboxProps {
  providerId: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function ModelCombobox({ providerId, value, onChange, disabled }: ModelComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  const { data: models = [], isLoading, error, refetch } = useProviderModels(providerId);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = query
    ? models.filter((m) => m.id.toLowerCase().includes(query.toLowerCase()))
    : models;

  const showDropdown = open && !disabled;

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-1.5">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => providerId !== "" && setOpen(true)}
          placeholder={!providerId ? "Select a provider first" : "Enter or pick a model"}
          disabled={disabled || !providerId}
        />
        {providerId ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            disabled={isLoading}
            onClick={() => refetch()}
            aria-label="Refresh models"
          >
            <RotateCw className={isLoading ? "size-3.5 animate-spin" : "size-3.5"} />
          </Button>
        ) : null}
      </div>
      {showDropdown ? (
        <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-lg border bg-popover shadow-lg">
          {isLoading && filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Loading models...</p>
          ) : error ? (
            <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-danger">
              <AlertTriangle className="size-3 shrink-0" />
              <span className="min-w-0 break-all">
                {error instanceof Error ? error.message : "Failed to load"}
              </span>
              <Button
                size="sm"
                variant="link"
                className="ml-auto h-auto px-1 py-0 text-xs"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No models found. Type to select custom value.
            </p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange(m.id);
                  setQuery(m.id);
                  setOpen(false);
                }}
              >
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{m.id}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
