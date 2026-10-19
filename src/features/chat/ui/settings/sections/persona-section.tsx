import { useCallback, useRef, useState } from "react";
import { Check, Image as ImageIcon, Pencil, Plus, Trash2, Upload, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { OptimizedImage } from "@/components/ui/optimized-image";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { SkeletonText } from "@/components/common/Skeletons";
import {
  usePersonas,
  useCreatePersona,
  useUpdatePersona,
  useDeletePersona,
  useUploadPersonaIcon,
  type PersonaListItem,
} from "@/hooks/usePersonas";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/useUserSettings";
import { MAX_IMAGE_UPLOAD_BYTES, withImageVersion } from "@/lib/image-optimization";
import { cn } from "@/lib/utils";
import { SectionHeader } from "../section-header";
import { getSaveState, useSettingsSaveStatus } from "../save-status";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
}

function PersonaAvatar({
  persona,
  className,
}: {
  persona: Pick<PersonaListItem, "name" | "iconPath" | "id"> | null;
  className?: string;
}) {
  if (persona?.iconPath) {
    return (
      <OptimizedImage
        key={persona.iconPath}
        src={withImageVersion(`/api/personas/${persona.id}/icon`, persona.iconPath)}
        alt=""
        preset="avatar"
        width={40}
        height={40}
        sizes="40px"
        quality={70}
        className={cn("size-10 shrink-0 rounded-full border border-border object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full border border-subtle bg-surface text-sm font-medium text-brand",
        className,
      )}
      aria-hidden="true"
    >
      {persona?.name.charAt(0).toUpperCase() ?? <User className="size-4" />}
    </span>
  );
}

function PersonaOption({
  name,
  description,
  persona,
  selected,
  onSelect,
}: {
  name: string;
  description?: string | null;
  persona: Pick<PersonaListItem, "name" | "iconPath" | "id"> | null;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-ring",
        selected ? "border-brand/30 bg-brand/10" : "border-transparent hover:bg-(--bg-hover)",
      )}
      aria-pressed={selected}
    >
      <PersonaAvatar persona={persona} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13px] font-medium text-1">{name}</span>
        {description ? <span className="line-clamp-1 text-xs text-2">{description}</span> : null}
      </span>
      {selected ? <Check className="size-4 shrink-0 text-brand" aria-hidden="true" /> : null}
    </button>
  );
}

type PersonaDialog =
  | { kind: "create" }
  | { kind: "edit"; id: string; name: string; description: string; iconPath: string | null }
  | null;

export function PersonaSection(_props: SectionProps) {
  const {
    data: settings,
    error: settingsError,
    refetch: refetchSettings,
    isLoading: settingsLoading,
  } = useUserSettings();
  const {
    data: personas,
    error: personasError,
    refetch: refetchPersonas,
    isLoading: personasLoading,
  } = usePersonas();
  const updateUserSettings = useUpdateUserSettings();
  const createPersona = useCreatePersona();
  const updatePersona = useUpdatePersona();
  const deletePersona = useDeletePersona();
  const uploadPersonaIcon = useUploadPersonaIcon();

  const retrySave = updateUserSettings.variables
    ? () => updateUserSettings.mutate(updateUserSettings.variables!)
    : undefined;
  useSettingsSaveStatus("persona", getSaveState(updateUserSettings), {
    retry: retrySave,
    at: updateUserSettings.submittedAt,
    error: updateUserSettings.error,
  });

  const [chooserOpen, setChooserOpen] = useState(false);
  const [dialog, setDialog] = useState<PersonaDialog>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pendingIconPath, setPendingIconPath] = useState<string | null>(null);
  const [failedIconPath, setFailedIconPath] = useState<string | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryError = settingsError ?? personasError;
  const queryLoading = settingsLoading || personasLoading;
  const selectedId = settings?.defaultPersonaId ?? "";
  const selectedPersona = personas?.find((p) => p.id === selectedId) ?? null;

  const reportMutationError = useCallback((action: string) => {
    return (err: unknown) => {
      console.error(`[settings] ${action}`, err);
      toast.error(`${action}. Please try again.`);
    };
  }, []);

  const selectPersona = useCallback(
    (id: string | null) => {
      updateUserSettings.mutate({ defaultPersonaId: id });
      setChooserOpen(false);
    },
    [updateUserSettings],
  );

  const openCreate = useCallback(() => {
    setName("");
    setDescription("");
    setIconError(null);
    setDialog({ kind: "create" });
  }, []);

  const openEdit = useCallback((persona: PersonaListItem) => {
    setName(persona.name);
    setDescription(persona.description ?? "");
    setPendingIconPath(null);
    setIconError(null);
    setDialog({
      kind: "edit",
      id: persona.id,
      name: persona.name,
      description: persona.description ?? "",
      iconPath: persona.iconPath,
    });
  }, []);

  const closeDialog = useCallback(() => setDialog(null), []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || dialog?.kind !== "edit") return;
      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        setIconError(`File too large (max ${MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024)} MB).`);
        e.target.value = "";
        return;
      }
      setIconError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        if (!base64) return;
        uploadPersonaIcon.mutate(
          { id: dialog.id, fileBase64: base64 },
          {
            onSuccess: (result) => setPendingIconPath(result.iconPath),
            onError: reportMutationError("Upload failed"),
          },
        );
      };
      reader.readAsDataURL(file);
    },
    [dialog, uploadPersonaIcon, reportMutationError],
  );

  const displayStoredIconPath =
    pendingIconPath ?? (dialog?.kind === "edit" ? dialog.iconPath : null);
  const showIcon = displayStoredIconPath !== null && failedIconPath !== displayStoredIconPath;

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (dialog?.kind === "create") {
      createPersona.mutate(
        { name: trimmed, description: description.trim() || undefined },
        { onSuccess: closeDialog, onError: reportMutationError("Couldn't create persona") },
      );
    } else if (dialog?.kind === "edit") {
      updatePersona.mutate(
        { id: dialog.id, name: trimmed, description: description.trim() || null },
        { onSuccess: closeDialog, onError: reportMutationError("Couldn't save persona") },
      );
    }
  }, [dialog, name, description, createPersona, updatePersona, closeDialog, reportMutationError]);

  const handleDelete = useCallback(() => {
    if (!deleteId) return;
    const deletingDefault = deleteId === selectedId;
    deletePersona.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          if (deletingDefault) updateUserSettings.mutate({ defaultPersonaId: null });
          toast.success("Persona deleted");
          setDeleteId(null);
        },
        onError: reportMutationError("Couldn't delete persona"),
      },
    );
  }, [deleteId, deletePersona, selectedId, updateUserSettings, reportMutationError]);

  const deleteTarget = personas?.find((p) => p.id === deleteId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Your persona"
        description="The voice you use in every chat. Names and descriptions help the model write for you."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-1.5 max-sm:h-11"
            onClick={openCreate}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            New persona
          </Button>
        }
      />

      {queryError ? (
        <ErrorBanner
          message={queryError instanceof Error ? queryError.message : "Failed to load personas"}
          onRetry={() => {
            void Promise.all([refetchSettings(), refetchPersonas()]);
          }}
        />
      ) : null}

      {!queryError && queryLoading ? (
        <div role="status" className="space-y-2">
          <SkeletonText lines={2} />
          <span className="sr-only">Loading personas</span>
        </div>
      ) : null}

      {!queryLoading ? (
        <div className="rounded-2xl border border-subtle bg-surface/60 p-4">
          <div className="flex flex-wrap items-start gap-3">
            <PersonaAvatar persona={selectedPersona} className="size-11" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-1">
                  {selectedPersona?.name ?? "Account name"}
                </p>
                {selectedPersona ? (
                  <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                    Default
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-2">
                {selectedPersona?.description ||
                  "Your account name is used when no persona is selected."}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-10 max-sm:h-11"
                onClick={() => setChooserOpen(true)}
              >
                Change
              </Button>
              {selectedPersona ? (
                <RowActionsMenu
                  label={`Actions for ${selectedPersona.name}`}
                  items={[
                    {
                      label: "Edit persona",
                      icon: Pencil,
                      onSelect: () => openEdit(selectedPersona),
                    },
                    {
                      label: "Delete persona",
                      icon: Trash2,
                      destructive: true,
                      onSelect: () => setDeleteId(selectedPersona.id),
                    },
                  ]}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose persona</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[min(60vh,26rem)] flex-col gap-1 overflow-y-auto pr-1">
            <PersonaOption
              name="Account name"
              description="Use the name on your account."
              persona={null}
              selected={!selectedPersona}
              onSelect={() => selectPersona(null)}
            />
            {personas?.map((persona) => (
              <PersonaOption
                key={persona.id}
                name={persona.name}
                description={persona.description}
                persona={persona}
                selected={persona.id === selectedId}
                onSelect={() => selectPersona(persona.id)}
              />
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setChooserOpen(false);
                openCreate();
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              New persona
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.kind === "edit" ? "Edit persona" : "New persona"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pd-name">Name</Label>
              <Input
                id="pd-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Persona name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pd-desc">Description</Label>
              <Textarea
                id="pd-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            {dialog?.kind === "edit" ? (
              <div className="space-y-1.5">
                <Label>Icon</Label>
                <div className="flex flex-wrap items-center gap-3">
                  {showIcon && displayStoredIconPath ? (
                    <OptimizedImage
                      key={displayStoredIconPath}
                      src={withImageVersion(
                        `/api/personas/${dialog.id}/icon`,
                        displayStoredIconPath,
                      )}
                      alt=""
                      preset="avatar"
                      width={64}
                      height={64}
                      sizes="64px"
                      quality={70}
                      priority
                      className="size-16 rounded-full border border-border object-cover"
                      onError={() => setFailedIconPath(displayStoredIconPath)}
                    />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-full border border-border bg-muted">
                      <ImageIcon className="size-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadPersonaIcon.isPending}
                    className="gap-1.5"
                  >
                    {uploadPersonaIcon.isPending ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <Upload className="size-3.5" data-icon="inline-start" />
                    )}
                    Upload
                  </Button>
                  <span role="status" className="sr-only">
                    {uploadPersonaIcon.isPending ? "Uploading persona icon" : ""}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/tiff,image/gif,image/avif"
                    className="hidden"
                    onChange={handleFileChange}
                    aria-label="Upload persona icon"
                  />
                  {iconError ? (
                    <p className="text-xs text-destructive" role="alert">
                      {iconError}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || createPersona.isPending || updatePersona.isPending}
            >
              {dialog?.kind === "edit" ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title={`Delete ${deleteTarget?.name ?? "persona"}?`}
        description="This removes the persona permanently. Your chats keep their messages."
        destructive
        loading={deletePersona.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
