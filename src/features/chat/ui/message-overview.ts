import type { ActivePathEntry } from "@/features/chat/tree/types";

export interface MessageTick {
  id: string;
  role: "user" | "assistant";
  preview: string;
}

const PREVIEW_MAX = 100;

/** Collapse whitespace and truncate content for the hover preview. */
export function previewText(content: string, max = PREVIEW_MAX): string {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

/** Map active-path entries to rail ticks (system messages excluded). */
export function toTicks(entries: ActivePathEntry[]): MessageTick[] {
  return entries
    .filter((entry) => entry.message.role !== "system")
    .map((entry) => ({
      id: String(entry.message.localId),
      role: entry.message.role as MessageTick["role"],
      preview: previewText(entry.message.content),
    }));
}

/** Map a 0..1 ratio along the track to the nearest message index. */
export function nearestIndex(ratio: number, count: number): number {
  if (count <= 1) return 0;
  const clamped = Math.min(1, Math.max(0, ratio));
  return Math.round(clamped * (count - 1));
}

/** Resolve a pointer position on the track to a message index. */
export function indexFromPointer(
  clientY: number,
  rectTop: number,
  rectHeight: number,
  count: number,
): number {
  if (rectHeight <= 0) return 0;
  return nearestIndex((clientY - rectTop) / rectHeight, count);
}

/**
 * The message the viewport is currently "at". Prefers the scroller's current
 * anchor (the current user turn) and falls back to the first visible message.
 * `currentAnchorId` is only ever a user message — items register as anchors
 * only when `scrollAnchor` is set, and the chat marks user messages as anchors.
 */
export function activeTickIndex(
  ticks: MessageTick[],
  currentAnchorId: string | null,
  visibleMessageIds: string[],
): number {
  if (ticks.length === 0) return 0;
  if (currentAnchorId) {
    const anchor = ticks.findIndex((tick) => tick.id === currentAnchorId);
    if (anchor !== -1) return anchor;
  }
  const visible = new Set(visibleMessageIds);
  const firstVisible = ticks.findIndex((tick) => visible.has(tick.id));
  return firstVisible === -1 ? 0 : firstVisible;
}
