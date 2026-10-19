import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusDot } from "@/components/common/StatusDot";
import { authClient } from "@/lib/auth-client";
import { useCreatePersona, usePersonas, useUpdatePersona } from "@/hooks/usePersonas";
import { useUpdateUserSettings, useUserSettings } from "@/hooks/useUserSettings";

export function PersonaStep() {
  const { data: session } = authClient.useSession();
  const { data: settings } = useUserSettings();
  const { data: personas = [] } = usePersonas();
  const createPersona = useCreatePersona();
  const updatePersona = useUpdatePersona();
  const updateSettings = useUpdateUserSettings();

  const current = useMemo(
    () => personas.find((persona) => persona.id === settings?.defaultPersonaId),
    [personas, settings?.defaultPersonaId],
  );

  const suggestedName =
    current && current.name !== "Default" ? current.name : session?.user?.name || "You";

  const [name, setName] = useState(suggestedName);
  const [description, setDescription] = useState(current?.description ?? "");
  const [saved, setSaved] = useState(false);
  const [touched, setTouched] = useState(false);

  // The persona query resolves after the step mounts. Adopt the stored persona
  // (or the account name) unless the user has already started typing.
  useEffect(() => {
    if (touched) return;
    if (current && current.name !== "Default") {
      setName(current.name);
      setDescription(current.description ?? "");
      return;
    }
    // The seeded persona is a placeholder; do not present its text as if the
    // user had written it.
    setName(session?.user?.name || "You");
    setDescription("");
  }, [current, session?.user?.name, touched]);

  const saving = createPersona.isPending || updatePersona.isPending || updateSettings.isPending;

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Give your persona a name first");
      return;
    }
    try {
      setSaved(false);
      let id = current?.id;
      if (id) {
        await updatePersona.mutateAsync({ id, name: trimmedName, description });
      } else {
        const created = await createPersona.mutateAsync({ name: trimmedName, description });
        id = created.id;
      }
      await updateSettings.mutateAsync({ defaultPersonaId: id });
      setSaved(true);
      toast.success("Persona saved");
    } catch (error) {
      toast.error((error as Error).message || "Could not save your persona");
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-2 text-sm leading-relaxed">
        This is you in the story. Characters will use this name, and the model will write around the
        details you give it. You can change everything later.
      </p>

      <div className="grid gap-1.5">
        <Label htmlFor="persona-name">Your name</Label>
        <Input
          id="persona-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setTouched(true);
            setSaved(false);
          }}
          placeholder="You"
          autoComplete="off"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="persona-description">About you (optional)</Label>
        <Textarea
          id="persona-description"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setTouched(true);
            setSaved(false);
          }}
          placeholder="A traveler with a dry sense of humor, here for the story."
          rows={4}
        />
        <p className="text-3 text-xs">
          A sentence or two is enough. This is not shown to the character as narration; it is the
          context the model uses when writing for you.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => void save()}
          disabled={saving || !name.trim()}
        >
          {saving ? "Saving..." : "Save persona"}
        </Button>
        {saved ? <StatusDot tone="success" label="Saved" /> : null}
        {!saved ? <span className="text-2 text-xs">Optional. Next works too.</span> : null}
      </div>
    </div>
  );
}
