import { useState } from "react";
import { X, Info } from "lucide-react";

const STORAGE_KEY = "charon.demoBannerDismissed";

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  });

  if (dismissed) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-brand/10 px-4 py-2 text-center text-xs text-brand-strong border-b border-brand/20">
      <Info className="size-3.5 shrink-0" />
      <span>
        Demo account — managing characters, providers, and users requires an admin account.
      </span>
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") sessionStorage.setItem(STORAGE_KEY, "1");
          setDismissed(true);
        }}
        className="ml-auto inline-flex size-5 shrink-0 items-center justify-center rounded-sm hover:bg-brand/20"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
