import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: "Ctrl+Shift+R", description: "Regenerate last assistant message" },
  { keys: "Ctrl+Shift+←", description: "Previous response (swipe)" },
  { keys: "Ctrl+Shift+→", description: "Next response (swipe)" },
  { keys: "Ctrl+I", description: "Impersonate (write as character)" },
  { keys: "?", description: "Toggle this shortcuts dialog" },
];

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Navigate and control the chat without the mouse.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between gap-4 rounded-lg bg-white/5 px-3 py-2"
            >
              <span className="text-sm text-[--sea-ink-soft]">{s.description}</span>
              <kbd className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-mono text-[--sea-ink] shrink-0">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
