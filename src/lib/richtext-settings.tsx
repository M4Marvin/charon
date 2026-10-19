import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "stv.richtext";
const CHANGE_EVENT = "stv:richtext-change";

export interface StoredSettings {
  blockExternalMedia: boolean;
  highlightDialogue: boolean;
  autoFixMarkdown: boolean;
}

const DEFAULTS: StoredSettings = {
  blockExternalMedia: false,
  highlightDialogue: true,
  autoFixMarkdown: true,
};

let cachedRaw: string | null = null;
let cachedValue: StoredSettings = DEFAULTS;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseStored(raw: string | null): StoredSettings {
  if (!raw) return DEFAULTS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULTS;
    const value = parsed as Partial<StoredSettings>;
    return {
      blockExternalMedia:
        typeof value.blockExternalMedia === "boolean"
          ? value.blockExternalMedia
          : DEFAULTS.blockExternalMedia,
      highlightDialogue:
        typeof value.highlightDialogue === "boolean"
          ? value.highlightDialogue
          : DEFAULTS.highlightDialogue,
      autoFixMarkdown:
        typeof value.autoFixMarkdown === "boolean"
          ? value.autoFixMarkdown
          : DEFAULTS.autoFixMarkdown,
    };
  } catch {
    return DEFAULTS;
  }
}

function getSnapshot(): StoredSettings {
  if (typeof window === "undefined") return DEFAULTS;
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parseStored(raw);
  }
  return cachedValue;
}

function getServerSnapshot(): StoredSettings {
  return DEFAULTS;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function writeStored(next: StoredSettings) {
  cachedRaw = null;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode, quota); keep the in-memory
    // snapshot correct for this tab even when persistence fails.
    cachedRaw = readRaw();
    cachedValue = next;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export interface RichTextSettings {
  blockExternalMedia: boolean;
  setBlockExternalMedia: (v: boolean) => void;
  highlightDialogue: boolean;
  setHighlightDialogue: (v: boolean) => void;
  autoFixMarkdown: boolean;
  setAutoFixMarkdown: (v: boolean) => void;
}

const defaults: RichTextSettings = {
  blockExternalMedia: false,
  setBlockExternalMedia: () => {},
  highlightDialogue: true,
  setHighlightDialogue: () => {},
  autoFixMarkdown: true,
  setAutoFixMarkdown: () => {},
};

const RichTextSettingsCtx = createContext<RichTextSettings>(defaults);

export function RichTextSettingsProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const update = useCallback((patch: Partial<StoredSettings>) => {
    writeStored({ ...getSnapshot(), ...patch });
  }, []);

  const setBlockExternalMedia = useCallback(
    (v: boolean) => update({ blockExternalMedia: v }),
    [update],
  );
  const setHighlightDialogue = useCallback(
    (v: boolean) => update({ highlightDialogue: v }),
    [update],
  );
  const setAutoFixMarkdown = useCallback((v: boolean) => update({ autoFixMarkdown: v }), [update]);

  const value: RichTextSettings = useMemo(
    () => ({
      blockExternalMedia: stored.blockExternalMedia,
      setBlockExternalMedia,
      highlightDialogue: stored.highlightDialogue,
      setHighlightDialogue,
      autoFixMarkdown: stored.autoFixMarkdown,
      setAutoFixMarkdown,
    }),
    [
      stored.blockExternalMedia,
      stored.highlightDialogue,
      stored.autoFixMarkdown,
      setBlockExternalMedia,
      setHighlightDialogue,
      setAutoFixMarkdown,
    ],
  );

  return <RichTextSettingsCtx.Provider value={value}>{children}</RichTextSettingsCtx.Provider>;
}

export function useRichTextSettings(): RichTextSettings {
  return useContext(RichTextSettingsCtx);
}
