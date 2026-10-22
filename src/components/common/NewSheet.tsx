import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, MessageCircle, Upload } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const NEW_SHEET_EVENT = "charon:new-sheet";

export function openNewSheet() {
  window.dispatchEvent(new Event(NEW_SHEET_EVENT));
}

export function NewSheet() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const toggle = () => setOpen((value) => !value);
    window.addEventListener(NEW_SHEET_EVENT, toggle);
    return () => window.removeEventListener(NEW_SHEET_EVENT, toggle);
  }, []);

  const go = (to: "/characters" | "/characters/new" | "/lorebooks/new") => {
    setOpen(false);
    void navigate({ to });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        className="mx-auto w-full max-w-md rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader>
          <SheetTitle>New</SheetTitle>
          <SheetDescription>Start something new.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={() => go("/characters")}
            className="focus-ring flex min-h-14 items-center gap-3 rounded-xl border border-subtle bg-surface px-4 text-left"
          >
            <MessageCircle className="size-5 text-brand" aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium text-1">New chat</span>
              <span className="block text-xs text-2">Pick a character and start talking.</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => go("/characters/new")}
            className="focus-ring flex min-h-14 items-center gap-3 rounded-xl border border-subtle bg-surface px-4 text-left"
          >
            <Upload className="size-5 text-brand" aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium text-1">Import character</span>
              <span className="block text-xs text-2">Bring in a PNG character card.</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => go("/lorebooks/new")}
            className="focus-ring flex min-h-14 items-center gap-3 rounded-xl border border-subtle bg-surface px-4 text-left"
          >
            <BookOpen className="size-5 text-brand" aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium text-1">New lorebook</span>
              <span className="block text-xs text-2">Build keyword-triggered world lore.</span>
            </span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
