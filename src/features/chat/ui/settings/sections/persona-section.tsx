import { useState, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, Image as ImageIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  usePersonas,
  useCreatePersona,
  useUpdatePersona,
  useDeletePersona,
  useUploadPersonaIcon,
} from "@/hooks/usePersonas";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/useUserSettings";
import { ConfirmDialog } from "../confirm-dialog";
import { SectionHeader } from "../section-header";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
  isAdmin: boolean;
}

export function PersonaSection(_props: SectionProps) {
  const { data: settings } = useUserSettings();
  const { data: personas } = usePersonas();
  const updateUserSettings = useUpdateUserSettings();
  const createPersona = useCreatePersona();
  const updatePersona = useUpdatePersona();
  const deletePersona = useDeletePersona();
  const uploadPersonaIcon = useUploadPersonaIcon();

  const [dialog, setDialog] = useState<
    | { kind: "create" }
    | { kind: "edit"; id: string; name: string; description: string; iconPath: string | null }
    | null
  >(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pendingIconPath, setPendingIconPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedId = settings?.defaultPersonaId ?? "";

  const handlePersonaChange = useCallback(
    (id: string) => {
      updateUserSettings.mutate({ defaultPersonaId: id === "_none" ? null : id });
    },
    [updateUserSettings],
  );

  const openCreate = useCallback(() => {
    setName("");
    setDescription("");
    setDialog({ kind: "create" });
  }, []);

  const openEdit = useCallback((id: string, n: string, d: string | null, icon: string | null) => {
    setName(n);
    setDescription(d ?? "");
    setPendingIconPath(null);
    setDialog({ kind: "edit", id, name: n, description: d ?? "", iconPath: icon });
  }, []);

  const closeDialog = useCallback(() => setDialog(null), []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || dialog?.kind !== "edit") return;
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        if (!base64) return;
        uploadPersonaIcon.mutate(
          { id: dialog.id, fileBase64: base64 },
          {
            onSuccess: (result) => setPendingIconPath(result.iconPath),
          },
        );
      };
      reader.readAsDataURL(file);
    },
    [dialog, uploadPersonaIcon],
  );

  const displayIconPath = pendingIconPath ?? (dialog?.kind === "edit" ? dialog.iconPath : null);

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (dialog?.kind === "create") {
      createPersona.mutate(
        { name: trimmed, description: description.trim() || undefined },
        { onSuccess: closeDialog },
      );
    } else if (dialog?.kind === "edit") {
      updatePersona.mutate(
        { id: dialog.id, name: trimmed, description: description.trim() || null },
        { onSuccess: closeDialog },
      );
    }
  }, [dialog, name, description, createPersona, updatePersona, closeDialog]);

  const handleDelete = useCallback(() => {
    if (!deleteId) return;
    deletePersona.mutate({ id: deleteId }, { onSuccess: () => setDeleteId(null) });
  }, [deleteId, deletePersona]);

  const selectedPersona = personas?.find((p) => p.id === selectedId);

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title="Persona" />

      <Field className="space-y-1.5">
        <FieldLabel htmlFor="ps-persona">Active persona</FieldLabel>
        <div className="flex gap-2">
          <Select value={selectedId || "_none"} onValueChange={handlePersonaChange}>
            <SelectTrigger id="ps-persona" className="flex-1">
              <SelectValue placeholder="None (account name)" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="_none">None (account name)</SelectItem>
                {personas?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            onClick={openCreate}
            aria-label="Create persona"
          >
            <Plus className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            disabled={!selectedId}
            onClick={() =>
              selectedPersona &&
              openEdit(
                selectedPersona.id,
                selectedPersona.name,
                selectedPersona.description,
                selectedPersona.iconPath,
              )
            }
            aria-label="Edit persona"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            disabled={!selectedId}
            onClick={() => setDeleteId(selectedId)}
            aria-label="Delete persona"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </Field>

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
            {dialog?.kind === "edit" && (
              <div className="space-y-1.5">
                <Label>Icon</Label>
                <div className="flex items-center gap-3">
                  {displayIconPath ? (
                    <img
                      src={`/api/personas/${dialog.id}/icon`}
                      alt=""
                      className="size-16 rounded-lg object-cover border border-border"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="size-16 rounded-lg bg-muted flex items-center justify-center border border-border">
                      <ImageIcon className="size-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadPersonaIcon.isPending}
                    className="flex items-center gap-1.5"
                    aria-live="polite"
                  >
                    <Upload className="size-3.5" data-icon="inline-start" />
                    {uploadPersonaIcon.isPending ? "Uploading..." : "Upload"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png"
                    className="hidden"
                    onChange={handleFileChange}
                    aria-label="Upload persona icon"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
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
        title="Delete persona?"
        description="This cannot be undone."
        onConfirm={handleDelete}
      />
    </div>
  );
}
