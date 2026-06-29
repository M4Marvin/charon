import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, RotateCw, Zap } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAiProviders } from "@/hooks/useAiProviders";
import {
  useCreateAiProvider,
  useDeleteAiProvider,
  type AiProviderListItem,
  useTestProviderConnection,
  useUpdateAiProvider,
} from "@/hooks/useAiProviders";
import {
  usePresets,
  useCreatePreset,
  useUpdatePreset,
  useDeletePreset,
  type PresetListItem,
} from "@/hooks/usePresets";
import { useProviderModels } from "@/hooks/useProviderModels";
import {
  useCreatePersona,
  useDeletePersona,
  usePersonas,
  useUpdatePersona,
  type PersonaListItem,
} from "@/hooks/usePersonas";
import {
  useDeleteLorebookEntry,
  useLorebookEntries,
  useLorebooks,
  useToggleLoreEntry,
  useToggleLorebook,
} from "@/hooks/useLorebooks";
import { EntryEditorDialog } from "@/components/lorebook/EntryEditorDialog";
import { ImportLorebookDialog } from "@/components/lorebook/ImportLorebookDialog";
import { PresetDialog } from "@/components/preset/PresetDialog";
import { ProviderDialog } from "@/components/ai/ProviderDialog";
import type { LoreEntry } from "@/db/schema";
import type { LorebookListItem } from "@/server/fns/lorebooks";
import { useUpdateChatSettings } from "@/hooks/useChats";
import { useUpdateUserSettings, useUserSettings } from "@/hooks/useUserSettings";
import type { ChatDetail } from "@/server/fns/chats";
import { authClient } from "@/lib/auth-client";
import { useBackgrounds, useUploadBackground, useDeleteBackground } from "@/hooks/useBackgrounds";
import { useRichTextSettings } from "@/lib/richtext-settings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ChatSettingsPanelProps {
  chat: ChatDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteChat?: () => void;
  isStreaming?: boolean;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
}

export function ChatSettingsPanel({
  chat,
  open,
  onOpenChange,
  onDeleteChat,
  isStreaming = false,
  activeTab,
  onActiveTabChange,
}: ChatSettingsPanelProps) {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Chat Settings</SheetTitle>
          <SheetDescription>Configure AI, lorebooks, persona, and prompts.</SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={onActiveTabChange}
          className="flex min-h-0 flex-1 flex-col pt-4"
        >
          <TabsList className="w-full shrink-0">
            {isAdmin && (
              <TabsTrigger value="ai" className="text-xs flex-1">
                AI
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="demo-ai" className="text-xs flex-1">
                Demo AI
              </TabsTrigger>
            )}
            <TabsTrigger value="lorebooks" className="text-xs flex-1">
              Lorebooks
            </TabsTrigger>
            <TabsTrigger value="persona" className="text-xs flex-1">
              Persona
            </TabsTrigger>
            <TabsTrigger value="prompts" className="text-xs flex-1">
              Prompts
            </TabsTrigger>
            <TabsTrigger value="scene" className="text-xs flex-1">
              Scene
            </TabsTrigger>
            <TabsTrigger value="display" className="text-xs flex-1">
              Display
            </TabsTrigger>
          </TabsList>
          <div className="relative min-h-0 flex-1">
            {activeTab === "ai" && isAdmin && (
              <div className="absolute inset-0 overflow-y-auto p-4">
                <AiSection chat={chat} isStreaming={isStreaming} />
              </div>
            )}
            {activeTab === "demo-ai" && isAdmin && (
              <div className="absolute inset-0 overflow-y-auto p-4">
                <DemoAiConfigSection />
              </div>
            )}
            {activeTab === "lorebooks" && (
              <div className="absolute inset-0 overflow-y-auto p-4">
                <LorebooksSection />
              </div>
            )}
            {activeTab === "persona" && (
              <div className="absolute inset-0 overflow-y-auto p-4">
                <PersonaSection />
              </div>
            )}
            {activeTab === "prompts" && (
              <div className="absolute inset-0 overflow-y-auto p-4">
                <PromptsSection />
              </div>
            )}
            {activeTab === "scene" && (
              <div className="absolute inset-0 overflow-y-auto p-4">
                <SceneSection chat={chat} isDemo={!isAdmin} />
              </div>
            )}
            {activeTab === "display" && (
              <div className="absolute inset-0 overflow-y-auto p-4">
                <DisplaySection />
              </div>
            )}
          </div>
        </Tabs>

        {onDeleteChat && (
          <SheetFooter>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive w-full justify-start"
              onClick={onDeleteChat}
            >
              Delete this chat
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Display section ────────────────────────────────────────────────────────

function DisplaySection() {
  const { blockExternalMedia, setBlockExternalMedia, highlightDialogue, setHighlightDialogue } =
    useRichTextSettings();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Highlight dialogue</p>
          <p className="text-muted-foreground text-xs">
            Highlight quoted dialogue in a distinct colour for VN-style reading.
          </p>
        </div>
        <Switch checked={highlightDialogue} onCheckedChange={setHighlightDialogue} />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Block external media</p>
          <p className="text-muted-foreground text-xs">
            Prevent images, videos and embeds from loading from external URLs.
          </p>
        </div>
        <Switch checked={blockExternalMedia} onCheckedChange={setBlockExternalMedia} />
      </div>
    </div>
  );
}

// ── Scene section ───────────────────────────────────────────────────────────

function SceneSection({ chat, isDemo }: { chat: ChatDetail; isDemo: boolean }) {
  const { data: backgrounds = [] } = useBackgrounds();
  const updateSettings = useUpdateChatSettings();
  const upload = useUploadBackground();
  const deleteBg = useDeleteBackground();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedId = chat.backgroundPath ?? "";
  const handleSelect = (id: string | null) => {
    updateSettings.mutate({ id: chat.id, backgroundPath: id });
  };

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1] ?? "";
      upload.mutate({ name: file.name, fileBase64: base64 });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">Set a background scene for this chat.</p>

      {selectedId ? (
        <Button variant="outline" size="sm" className="w-full" onClick={() => handleSelect(null)}>
          Clear background
        </Button>
      ) : (
        <p className="text-muted-foreground text-xs text-center">No background set</p>
      )}

      {backgrounds.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {backgrounds.map((bg) => (
            <div key={bg.id} className="group relative">
              <img
                src={`/api/backgrounds/${bg.id}/image`}
                alt={bg.name}
                className={`aspect-video w-full rounded-lg object-cover cursor-pointer border-2 transition-all ${
                  selectedId === bg.id
                    ? "border-(--lagoon) ring-1 ring-(--lagoon)"
                    : "border-transparent hover:border-white/20"
                }`}
                onClick={() => handleSelect(selectedId === bg.id ? null : bg.id)}
              />
              {!isDemo && (
                <button
                  className="absolute top-0.5 right-0.5 size-5 rounded-full bg-background/80 flex items-center justify-center text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(bg.id);
                  }}
                  aria-label={`Delete ${bg.name}`}
                >
                  ✕
                </button>
              )}
              <p className="text-muted-foreground mt-0.5 truncate text-[10px]">{bg.name}</p>
            </div>
          ))}
        </div>
      )}

      {!isDemo && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={upload.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {upload.isPending ? "Uploading..." : "Upload background"}
          </Button>
        </div>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete background?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this background. Chats using it will revert to the
              default look.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  deleteBg.mutate({ id: deleteTarget });
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── AI section ─────────────────────────────────────────────────────────────

function AiSection({ chat, isStreaming }: { chat: ChatDetail; isStreaming: boolean }) {
  const { data: providers = [] } = useAiProviders();
  const { data: presets = [] } = usePresets();
  const updateSettings = useUpdateChatSettings();
  const updateUserDefaults = useUpdateUserSettings();

  const selectedProviderId = chat.providerId ?? "";
  const selectedPresetId = chat.presetId ?? "";
  const selectedModel = chat.selectedModel ?? "";

  const {
    data: models = [],
    isLoading: modelsLoading,
    error: modelsError,
    refetch: refetchModels,
  } = useProviderModels(selectedProviderId);
  const [editing, setEditing] = useState<PresetListItem | "new" | null>(null);
  const [editingProvider, setEditingProvider] = useState<AiProviderListItem | "new" | null>(null);
  const createPreset = useCreatePreset();
  const updatePreset = useUpdatePreset();
  const deletePreset = useDeletePreset();
  const createProvider = useCreateAiProvider();
  const updateProvider = useUpdateAiProvider();
  const deleteProvider = useDeleteAiProvider();

  const testConnection = useTestProviderConnection();

  const isLocked = isStreaming;

  const handleChangeProvider = useCallback(
    (providerId: string) => {
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
        <div className="flex gap-1.5">
          <div className="flex-1">
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
                  <div className="text-muted-foreground px-3 py-2 text-xs">
                    No providers configured
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          {selectedProviderId && (
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0"
              disabled={isLocked || testConnection.isPending}
              onClick={() => testConnection.mutate(selectedProviderId)}
              aria-label="Test connection"
            >
              {testConnection.isPending ? <Spinner /> : <Zap className="size-3.5" />}
            </Button>
          )}
        </div>

        {/* Test result */}
        {testConnection.data && (
          <div
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
              testConnection.data.ok
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {testConnection.data.ok ? (
              <>
                <Check className="size-3 shrink-0" />
                <span>
                  {testConnection.data.latencyMs}ms &middot; {testConnection.data.modelCount} models
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="size-3 shrink-0" />
                <span className="min-w-0 break-all">
                  {testConnection.data.error ?? "Unknown error"}
                </span>
                <Button
                  size="sm"
                  variant="link"
                  className="ml-auto h-auto shrink-0 px-1 py-0 text-xs"
                  onClick={() => testConnection.mutate(selectedProviderId)}
                >
                  Retry
                </Button>
              </>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isLocked}
            onClick={() => setEditingProvider("new")}
          >
            + Add
          </Button>
          {selectedProviderId && (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={isLocked}
                onClick={() => {
                  const p = providers.find((x) => x.id === selectedProviderId);
                  if (p) setEditingProvider(p);
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isLocked}
                onClick={() => {
                  if (!window.confirm("Delete this provider?")) return;
                  deleteProvider.mutate(
                    { id: selectedProviderId },
                    {
                      onSuccess: () => {
                        toast.success("Provider deleted");
                        testConnection.reset();
                        handleChangeProvider("");
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

      <div className="space-y-1">
        <Label className="text-xs">Model</Label>
        <div className="flex gap-1.5">
          <div className="flex-1">
            <Select
              value={selectedModel}
              onValueChange={handleChangeModel}
              disabled={!selectedProviderId}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    !selectedProviderId
                      ? "Select a provider first"
                      : modelsLoading && models.length === 0
                        ? "Loading models..."
                        : "Select model"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id}
                  </SelectItem>
                ))}
                {models.length === 0 && selectedProviderId && !modelsLoading && !modelsError && (
                  <div className="text-muted-foreground px-3 py-2 text-xs">No models found</div>
                )}
              </SelectContent>
            </Select>
          </div>
          {selectedProviderId && (
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0"
              disabled={isLocked || modelsLoading}
              onClick={() => refetchModels()}
              aria-label="Reload models"
            >
              <RotateCw className={`size-3.5 ${modelsLoading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
        <Input
          value={selectedModel}
          onChange={(e) => handleChangeModel(e.target.value)}
          placeholder="Or type model ID"
          className="mt-1"
        />
        {modelsError && !modelsLoading && (
          <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
            <AlertTriangle className="size-3 shrink-0" />
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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={isLocked} onClick={() => setEditing("new")}>
            + Add
          </Button>
          {selectedPresetId && (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={isLocked}
                onClick={() => {
                  const p = presets.find((x) => x.id === selectedPresetId);
                  if (p) setEditing(p);
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isLocked}
                onClick={() => {
                  if (!window.confirm("Delete this preset?")) return;
                  deletePreset.mutate(
                    { id: selectedPresetId },
                    {
                      onSuccess: () => {
                        toast.success("Preset deleted");
                        handleChangePreset("");
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

      <PresetDialog
        state={editing}
        providers={providers}
        defaultModel={selectedModel}
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

      <ProviderDialog
        state={editingProvider}
        onClose={() => setEditingProvider(null)}
        onCreate={(input) =>
          createProvider.mutate(input, {
            onSuccess: ({ id }) => {
              toast.success("Provider created");
              setEditingProvider(null);
              handleChangeProvider(id);
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
    </div>
  );
}

// ── Lorebooks section ──────────────────────────────────────────────────────

function LorebooksSection() {
  const { data: lorebooks = [], isLoading } = useLorebooks();
  const toggle = useToggleLorebook();
  const [importOpen, setImportOpen] = useState(false);
  const [editLorebookId, setEditLorebookId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const enabled = lorebooks.filter((lb) => lb.enabled);
  const disabled = lorebooks.filter((lb) => !lb.enabled);

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-muted-foreground text-xs">Loading...</p>
      ) : enabled.length === 0 ? (
        <p className="text-muted-foreground text-xs">No active lorebooks.</p>
      ) : (
        <div className="space-y-1">
          {enabled.map((lb) => (
            <ExpandableLorebookRow
              key={lb.id}
              lorebook={lb}
              expanded={expandedId === lb.id}
              onToggleExpand={() => setExpandedId(expandedId === lb.id ? null : lb.id)}
              onDoubleClick={() => {
                setEditLorebookId(lb.id);
                setExpandedId(null);
              }}
              onRemove={() => toggle.mutate({ lorebookId: lb.id, enabled: false })}
              removePending={toggle.isPending}
            />
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {disabled.length > 0 && (
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Add lorebook</Label>
            <Select
              value=""
              onValueChange={(id) => toggle.mutate({ lorebookId: id, enabled: true })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="+ Add lorebook" />
              </SelectTrigger>
              <SelectContent>
                {disabled.map((lb) => (
                  <SelectItem key={lb.id} value={lb.id}>
                    {lb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          Import
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Edit lorebook</Label>
        <Select value={editLorebookId} onValueChange={setEditLorebookId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select lorebook to edit" />
          </SelectTrigger>
          <SelectContent>
            {lorebooks.map((lb) => (
              <SelectItem key={lb.id} value={lb.id}>
                {lb.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {editLorebookId && <LorebookEditor key={editLorebookId} lorebookId={editLorebookId} />}

      <ImportLorebookDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function ExpandableLorebookRow({
  lorebook,
  expanded,
  onToggleExpand,
  onDoubleClick,
  onRemove,
  removePending,
}: {
  lorebook: LorebookListItem;
  expanded: boolean;
  onToggleExpand: () => void;
  onDoubleClick: () => void;
  onRemove: () => void;
  removePending: boolean;
}) {
  const clickRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = () => {
    if (clickRef.current) {
      clearTimeout(clickRef.current);
      clickRef.current = null;
      return;
    }
    clickRef.current = setTimeout(() => {
      clickRef.current = null;
      onToggleExpand();
    }, 250);
  };

  const handleDblClick = () => {
    if (clickRef.current) {
      clearTimeout(clickRef.current);
      clickRef.current = null;
    }
    onDoubleClick();
  };

  return (
    <div>
      <div
        className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
        onClick={handleClick}
        onDoubleClick={handleDblClick}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-muted-foreground text-xs">{expanded ? "▾" : "▸"}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{lorebook.name}</p>
            <Badge variant="secondary" className="text-xs">
              {lorebook.entryCount} {lorebook.entryCount === 1 ? "entry" : "entries"}
            </Badge>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={removePending}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${lorebook.name}`}
        >
          ✕
        </Button>
      </div>
      {expanded && <ExpandedDetails lorebookId={lorebook.id} />}
    </div>
  );
}

function ExpandedDetails({ lorebookId }: { lorebookId: string }) {
  const { data: entries, isLoading } = useLorebookEntries(lorebookId);
  const toggle = useToggleLoreEntry(lorebookId);

  if (isLoading) {
    return <p className="text-muted-foreground pl-6 py-1 text-xs">Loading entries...</p>;
  }
  if (!entries || entries.length === 0) {
    return <p className="text-muted-foreground pl-6 py-1 text-xs">No entries.</p>;
  }

  return (
    <div className="max-h-48 space-y-1 overflow-y-auto pl-6 py-1">
      {entries.map((entry) => {
        const authorDisabled = entry.data.disable === true;
        const userDisabled = entry.userDisabled === true;
        const effectiveOn = !authorDisabled && !userDisabled;

        return (
          <div
            key={entry.id}
            className="flex items-center justify-between gap-2 rounded-md px-2 py-1"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs">
                {entry.data.comment || (
                  <span className="text-muted-foreground italic">no comment</span>
                )}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {entry.data.key.join(", ") || "—"}
              </p>
            </div>
            <Switch
              checked={effectiveOn}
              disabled={toggle.isPending || authorDisabled}
              onCheckedChange={(checked) =>
                toggle.mutate({ entryId: entry.id, disabled: !checked })
              }
              aria-label={`Toggle ${entry.data.comment || `entry ${entry.uid}`}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function LorebookEditor({ lorebookId }: { lorebookId: string }) {
  const { data: entries, isLoading } = useLorebookEntries(lorebookId);
  const deleteEntry = useDeleteLorebookEntry(lorebookId);
  const toggle = useToggleLoreEntry(lorebookId);
  const [dialog, setDialog] = useState<
    { kind: "closed" } | { kind: "create" } | { kind: "edit"; entry: LoreEntry }
  >({ kind: "closed" });

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Entries</p>
        <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "create" })}>
          New Entry
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-xs">Loading entries...</p>
      ) : !entries || entries.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-xs">No entries yet.</p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => {
            const authorDisabled = entry.data.disable === true;
            const userDisabled = entry.userDisabled === true;
            const effectiveOn = !authorDisabled && !userDisabled;

            return (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">
                    {entry.data.comment || (
                      <span className="text-muted-foreground italic">no comment</span>
                    )}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {entry.data.key.join(", ") || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch
                    checked={effectiveOn}
                    disabled={toggle.isPending || authorDisabled}
                    onCheckedChange={(checked) =>
                      toggle.mutate({ entryId: entry.id, disabled: !checked })
                    }
                    aria-label={`Toggle ${entry.data.comment || `entry ${entry.uid}`}`}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDialog({ kind: "edit", entry })}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={deleteEntry.isPending}
                    onClick={() => {
                      if (window.confirm("Delete this entry?")) {
                        deleteEntry.mutate({ entryId: entry.id });
                      }
                    }}
                  >
                    Del
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dialog.kind === "create" && (
        <EntryEditorDialog
          lorebookId={lorebookId}
          mode="create"
          onClose={() => setDialog({ kind: "closed" })}
        />
      )}
      {dialog.kind === "edit" && (
        <EntryEditorDialog
          lorebookId={lorebookId}
          mode="edit"
          entry={dialog.entry}
          onClose={() => setDialog({ kind: "closed" })}
        />
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

// ── Auto-resize hook ───────────────────────────────────────────────────────

function useAutoResizeTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return ref;
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

  const systemRef = useAutoResizeTextarea(systemPrompt);
  const postHistoryRef = useAutoResizeTextarea(postHistoryInstructions);
  const impersonationRef = useAutoResizeTextarea(impersonationPrompt);

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Per-user prompt overrides. Changes save on blur.
      </p>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">System prompt</Label>
          <Textarea
            ref={systemRef}
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
            ref={postHistoryRef}
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
            ref={impersonationRef}
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

// ── Demo AI config section (admin only) ──────────────────────────────────────

function DemoAiConfigSection() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { getGlobalAiConfig } = await import("@/server/fns/admin");
        const config = await getGlobalAiConfig();
        setBaseUrl(config.baseUrl);
        setApiKey(config.apiKey);
        setDefaultModel(config.defaultModel ?? "");
      } catch {
        // Global provider not yet created
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { updateGlobalAiConfig } = await import("@/server/fns/admin");
      await updateGlobalAiConfig({ data: { baseUrl, apiKey, defaultModel } });
      toast.success("Demo AI provider updated");
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  }, [baseUrl, apiKey, defaultModel]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Demo AI Provider</p>
        <p className="text-muted-foreground text-xs">
          All demo users share this provider. Changes take effect immediately.
        </p>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Base URL</Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">API Key</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Default Model</Label>
          <Input
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            placeholder="gpt-4o-mini"
          />
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
