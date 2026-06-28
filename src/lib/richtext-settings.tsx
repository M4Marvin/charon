import { createContext, useCallback, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "stv.richtext";

interface StoredSettings {
  blockExternalMedia: boolean;
  highlightDialogue: boolean;
  autoFixMarkdown: boolean;
}

function readStored(): StoredSettings {
  if (typeof window === "undefined")
    return { blockExternalMedia: false, highlightDialogue: true, autoFixMarkdown: true };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { blockExternalMedia: false, highlightDialogue: true, autoFixMarkdown: true };
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

function persist(next: StoredSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export function RichTextSettingsProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useState(readStored);

  const setBlockExternalMedia = useCallback((v: boolean) => {
    setStored((prev) => {
      const next = { ...prev, blockExternalMedia: v };
      persist(next);
      return next;
    });
  }, []);

  const setHighlightDialogue = useCallback((v: boolean) => {
    setStored((prev) => {
      const next = { ...prev, highlightDialogue: v };
      persist(next);
      return next;
    });
  }, []);

  const setAutoFixMarkdown = useCallback((v: boolean) => {
    setStored((prev) => {
      const next = { ...prev, autoFixMarkdown: v };
      persist(next);
      return next;
    });
  }, []);

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
