import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAiProviders } from "@/hooks/useAiProviders";
import { usePresets } from "@/hooks/usePresets";
import { useProviderModels } from "@/hooks/useProviderModels";
import {
  useCreatePersona,
  useDeletePersona,
  usePersonas,
  useUpdatePersona,
  type PersonaListItem,
} from "@/hooks/usePersonas";
import { useLorebooks, useToggleLorebook } from "@/hooks/useLorebooks";
import { useUpdateChatSettings } from "@/hooks/useChats";
import { useUpdateUserSettings, useUserSettings } from "@/hooks/useUserSettings";
import type { ChatDetail } from "@/server/fns/chats";

interface ChatSettingsPanelProps {
  chat: ChatDetail;
  onClose: () => void;
}

export function ChatSettingsPanel({ chat, onClose }: ChatSettingsPanelProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="bg-popover text-popover-foreground border-border/60 absolute inset-[10vh_10vw] flex flex-col rounded-lg border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-lg border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs" aria-hidden>
              ⠿
            </span>
            <span className="text-sm font-semibold">Chat Settings</span>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close settings">
            ✕
          </Button>
        </div>

        {/* Tabbed body */}
        <div className="flex min-h-0 flex-1 flex-col">
          <Tabs defaultValue="ai" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-3 mt-2 w-auto shrink-0">
              <TabsTrigger value="ai" className="text-xs">
                AI
              </TabsTrigger>
              <TabsTrigger value="lorebooks" className="text-xs">
                Lorebooks
              </TabsTrigger>
              <TabsTrigger value="persona" className="text-xs">
                Persona
              </TabsTrigger>
              <TabsTrigger value="prompts" className="text-xs">
                Prompts
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ai" className="min-h-0 flex-1 overflow-y-auto p-4">
              <AiSection chat={chat} />
            </TabsContent>
            <TabsContent value="lorebooks" className="min-h-0 flex-1 overflow-y-auto p-4">
              <LorebooksSection />
            </TabsContent>
            <TabsContent value="persona" className="min-h-0 flex-1 overflow-y-auto p-4">
              <PersonaSection />
            </TabsContent>
            <TabsContent value="prompts" className="min-h-0 flex-1 overflow-y-auto p-4">
              <PromptsSection />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ── AI section ─────────────────────────────────────────────────────────────

function AiSection({ chat }: { chat: ChatDetail }) {
  const { data: providers = [] } = useAiProviders();
  const { data: presets = [] } = usePresets();
  const updateSettings = useUpdateChatSettings();
  const updateUserDefaults = useUpdateUserSettings();

  const selectedProviderId = chat.providerId ?? "";
  const selectedPresetId = chat.presetId ?? "";
  const selectedModel = chat.selectedModel ?? "";

  const { data: models = [] } = useProviderModels(selectedProviderId);

  const handleChangeProvider = useCallback(
    (providerId: string) => {
      // Changing the provider invalidates the previous model and preset.
      updateSettings.mutate({
        id: chat.id,
        providerId,
        selectedModel: null,
        presetId: null,
      });
      updateUserDefaults.mutate({
        defaultProviderId: providerId,
        defaultSelectedModel: null,
        defaultPresetId: null,
      });
    },
    [chat.id, updateSettings, updateUserDefaults],
  );

  const handleChangePreset = useCallback(
    (presetId: string) => {
      const value = presetId || null;
      updateSettings.mutate({ id: chat.id, presetId: value });
      updateUserDefaults.mutate({ defaultPresetId: value });
    },
    [chat.id, updateSettings, updateUserDefaults],
  );

  const handleChangeModel = useCallback(
    (model: string) => {
      const value = model || null;
      updateSettings.mutate({ id: chat.id, selectedModel: value });
      updateUserDefaults.mutate({ defaultSelectedModel: value });
    },
    [chat.id, updateSettings, updateUserDefaults],
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Provider</Label>
        <Select value={selectedProviderId} onValueChange={handleChangeProvider}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
            {providers.length === 0 && (
              <div className="text-muted-foreground px-3 py-2 text-xs">No providers configured</div>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Model</Label>
        <Select
          value={selectedModel}
          onValueChange={handleChangeModel}
          disabled={!selectedProviderId}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={selectedProviderId ? "Loading models..." : "Select a provider first"}
            />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.id}
              </SelectItem>
            ))}
            {models.length === 0 && selectedProviderId && (
              <div className="text-muted-foreground px-3 py-2 text-xs">No models fetched</div>
            )}
          </SelectContent>
        </Select>
        <Input
          value={selectedModel}
          onChange={(e) => handleChangeModel(e.target.value)}
          placeholder="Or type model ID"
          className="mt-1"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Preset</Label>
        <Select
          value={selectedPresetId || "_none"}
          onValueChange={(v) => handleChangePreset(v === "_none" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select preset" />
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
      </div>

      <Button asChild variant="outline" size="sm" className="w-full">
        <Link to="/ai-playground">Configure providers</Link>
      </Button>
    </div>
  );
}

// ── Lorebooks section ──────────────────────────────────────────────────────

function LorebooksSection() {
  const { data: lorebooks = [], isLoading } = useLorebooks();
  const toggle = useToggleLorebook();

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        Per-user activation. Enabled lorebooks apply to all chats.
      </p>
      {isLoading ? (
        <p className="text-muted-foreground text-xs">Loading...</p>
      ) : lorebooks.length === 0 ? (
        <p className="text-muted-foreground text-xs">No lorebooks yet.</p>
      ) : (
        <div className="space-y-1">
          {lorebooks.map((lb) => (
            <div
              key={lb.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{lb.name}</p>
                <Badge variant="secondary" className="text-xs">
                  {lb.entryCount} {lb.entryCount === 1 ? "entry" : "entries"}
                </Badge>
              </div>
              <Switch
                checked={lb.enabled}
                disabled={toggle.isPending}
                onCheckedChange={(checked) =>
                  toggle.mutate({ lorebookId: lb.id, enabled: checked })
                }
                aria-label={`Toggle ${lb.name}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Persona section (with CRUD) ───────────────────────────────────────────

function PersonaSection() {
  const { data: personas = [], isLoading } = usePersonas();
  const { data: userSettings } = useUserSettings();
  const updateUserDefaults = useUpdateUserSettings();
  const createPersona = useCreatePersona();
  const updatePersona = useUpdatePersona();
  const deletePersona = useDeletePersona();
  const [editing, setEditing] = useState<PersonaListItem | "new" | null>(null);

  const activeId = userSettings?.defaultPersonaId ?? "";

  const handleSelect = useCallback(
    (id: string) => {
      const value = id || null;
      updateUserDefaults.mutate({ defaultPersonaId: value });
    },
    [updateUserDefaults],
  );

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        The active persona's description is injected into the prompt for all chats.
      </p>
      <div className="space-y-1">
        <Label className="text-xs">Active persona</Label>
        <Select
          value={activeId || "_none"}
          onValueChange={(v) => handleSelect(v === "_none" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={isLoading ? "Loading..." : "No persona"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">— None —</SelectItem>
            {personas.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            + Add
          </Button>
          {activeId && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const p = personas.find((x) => x.id === activeId);
                  if (p) setEditing(p);
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!window.confirm("Delete this persona?")) return;
                  deletePersona.mutate(
                    { id: activeId },
                    {
                      onSuccess: () => {
                        toast.success("Persona deleted");
                        handleSelect("");
                      },
                      onError: (e) => toast.error(`Delete failed: ${(e as Error).message}`),
                    },
                  );
                }}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
      <PersonaDialog
        state={editing}
        onClose={() => setEditing(null)}
        onCreate={(input) =>
          createPersona.mutate(input, {
            onSuccess: (res) => {
              toast.success("Persona created");
              setEditing(null);
              handleSelect(res.id);
            },
            onError: (e) => toast.error(`Create failed: ${(e as Error).message}`),
          })
        }
        onUpdate={(input) =>
          updatePersona.mutate(input, {
            onSuccess: () => {
              toast.success("Persona updated");
              setEditing(null);
            },
            onError: (e) => toast.error(`Update failed: ${(e as Error).message}`),
          })
        }
      />
    </div>
  );
}

function PersonaDialog({
  state,
  onClose,
  onCreate,
  onUpdate,
}: {
  state: PersonaListItem | "new" | null;
  onClose: () => void;
  onCreate: (input: { name: string; description?: string }) => void;
  onUpdate: (input: { id: string; name?: string; description?: string | null }) => void;
}) {
  const open = state !== null;
  const editing = state && state !== "new" ? state : null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
    } else {
      setName("");
      setDescription("");
    }
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit persona" : "New persona"}</DialogTitle>
          <DialogDescription>The description is injected into the chat prompt.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="persona-name">Name</Label>
            <Input
              id="persona-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alice"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="persona-desc">Description</Label>
            <Textarea
              id="persona-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brave adventurer with a quick wit..."
              rows={5}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) {
                toast.error("Name is required");
                return;
              }
              const desc = description.trim();
              if (editing) {
                onUpdate({
                  id: editing.id,
                  name: name.trim(),
                  description: desc || null,
                });
              } else {
                onCreate({
                  name: name.trim(),
                  ...(desc ? { description: desc } : {}),
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

// ── Prompts section ────────────────────────────────────────────────────────

function PromptsSection() {
  const { data: userSettings } = useUserSettings();
  const updateUserDefaults = useUpdateUserSettings();

  const [systemPrompt, setSystemPrompt] = useState(userSettings?.systemPrompt ?? "");
  const [postHistoryInstructions, setPostHistoryInstructions] = useState(
    userSettings?.postHistoryInstructions ?? "",
  );
  const [impersonationPrompt, setImpersonationPrompt] = useState(
    userSettings?.impersonationPrompt ?? "",
  );

  // Sync local state when server data changes (e.g. on first load).
  useEffect(() => {
    setSystemPrompt(userSettings?.systemPrompt ?? "");
    setPostHistoryInstructions(userSettings?.postHistoryInstructions ?? "");
    setImpersonationPrompt(userSettings?.impersonationPrompt ?? "");
  }, [
    userSettings?.systemPrompt,
    userSettings?.postHistoryInstructions,
    userSettings?.impersonationPrompt,
  ]);

  const commit = useCallback(
    (field: "systemPrompt" | "postHistoryInstructions" | "impersonationPrompt", value: string) => {
      const next = value.trim() === "" ? null : value;
      updateUserDefaults.mutate({ [field]: next });
    },
    [updateUserDefaults],
  );

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Per-user prompt overrides. Changes save on blur.
      </p>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">System prompt</Label>
          <Textarea
            value={systemPrompt}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setSystemPrompt(e.target.value)}
            onBlur={(e) => commit("systemPrompt", e.target.value)}
            placeholder="You are a helpful assistant."
          />
          <p className="text-muted-foreground text-xs">Injected as the first system message.</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Post-history instructions</Label>
          <Textarea
            value={postHistoryInstructions}
            onChange={(e) => setPostHistoryInstructions(e.target.value)}
            onBlur={(e) => commit("postHistoryInstructions", e.target.value)}
            placeholder="[System note: ...]"
          />
          <p className="text-muted-foreground text-xs">
            Injected after the chat history. Overrides the character's.
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Impersonation prompt</Label>
          <Textarea
            value={impersonationPrompt}
            onChange={(e) => setImpersonationPrompt(e.target.value)}
            onBlur={(e) => commit("impersonationPrompt", e.target.value)}
            placeholder="Write the user's next message as: ..."
          />
          <p className="text-muted-foreground text-xs">
            Stored for the future impersonate feature. Not yet wired into generation.
          </p>
        </div>
      </div>
    </div>
  );
}
