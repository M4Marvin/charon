import { Button } from "@/components/ui/button";

interface SaveBarProps {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function SaveBar({ dirty, saving, onSave, onDiscard }: SaveBarProps) {
  if (!dirty) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t bg-popover/95 px-4 py-3 backdrop-blur-sm">
      <span className="text-2 text-sm">Unsaved changes</span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
