import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import type { AiProviderListItem } from "@/hooks/useAiProviders";

interface ProviderDialogProps {
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
  pending?: boolean;
}

export function ProviderDialog({ state, onClose, onCreate, onUpdate, pending }: ProviderDialogProps) {
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
      setApiKey("");
      setDefaultModel(editing.defaultModel ?? "");
      setHeadersText("");
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
              autoComplete="new-password"
              placeholder={editing ? "Leave blank to keep unchanged" : ""}
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
              placeholder={editing ? "Leave blank to keep unchanged" : '{"X-Header": "value"}'}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={pending}
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
                  ...(apiKey ? { apiKey } : {}),
                  defaultModel: defaultModel || null,
                  ...(defaultHeaders ? { defaultHeaders } : {}),
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
            {pending ? "Saving…" : editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
