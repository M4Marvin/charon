import { useEffect, useRef, useState, type RefObject } from "react";

/** Matches the panels' 200ms exit transition plus a small buffer. */
const UNMOUNT_DELAY_MS = 300;

interface FloatingPanelOptions {
  open: boolean;
  onClose: () => void;
  /**
   * Escape is ignored while true — e.g. while a nested confirm dialog owns
   * the Escape key. Changing this only re-arms the listener; focus is set on
   * open, never re-stolen.
   */
  escapeDisabled?: boolean;
  /** Focused when the panel opens (the panel's close button, typically). */
  focusRef: RefObject<HTMLElement | null>;
}

/**
 * Shared behavior for the chat page's floating side panels (portrait, scene):
 * keeps children mounted through the exit transition, focuses the panel on
 * open, and closes on Escape. Positioning stays plain CSS on the panels —
 * this hook is behavior only.
 */
export function useFloatingPanel({
  open,
  onClose,
  escapeDisabled = false,
  focusRef,
}: FloatingPanelOptions) {
  const [keepImageMounted, setKeepImageMounted] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Keep children mounted through the exit transition, then release them —
  // for a large decoded image, a real memory saving — once the panel is gone.
  useEffect(() => {
    if (open) {
      setKeepImageMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setKeepImageMounted(false), UNMOUNT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    focusRef.current?.focus();
  }, [open, focusRef]);

  useEffect(() => {
    if (!open || escapeDisabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
      onCloseRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, escapeDisabled]);

  return { keepImageMounted };
}
