import { useCallback, useMemo, useRef, useState } from "react";
import { useMessageScroller, useMessageScrollerVisibility } from "@/components/ui/message-scroller";
import { cn } from "@/lib/utils";
import type { ActivePathEntry } from "@/features/chat/tree/types";
import {
  activeTickIndex,
  indexFromPointer,
  toTicks,
  type MessageTick,
} from "@/features/chat/ui/message-overview";

const ROLE_WIDTH: Record<MessageTick["role"], string> = {
  user: "w-6",
  assistant: "w-4",
};

const PAGE_JUMP = 10;

/** Fixed centre-to-centre gap between ticks while the stack fits the cap. */
const TICK_GAP = 8;
/** The stack never exceeds this fraction of the message area's height. */
const MAX_HEIGHT_FRACTION = 0.4;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Right-edge message overview: one decorative tick per active-path message.
 *
 * The stack keeps a fixed centre-to-centre gap, so spacing is independent of
 * the message count. The natural span is `(count - 1) * TICK_GAP`, which is
 * known at render time, so the track height is expressed as
 * `min(100%, (count - 1) * TICK_GAP)` — `100%` is the cap box
 * ({@link MAX_HEIGHT_FRACTION} of the message area). Ticks are spread evenly
 * across whatever the track resolves to: while the natural span fits the cap
 * that yields exactly `TICK_GAP`; once it exceeds the cap, `100%` wins and the
 * gap compresses proportionally. All of that is pure CSS — no measurement.
 *
 * The track itself is the control (a vertical slider) — click or arrow-key to
 * jump to the nearest message.
 */
export function MessageOverviewRail({ entries }: { entries: ActivePathEntry[] }) {
  const ticks = useMemo(() => toTicks(entries), [entries]);
  const count = ticks.length;
  const { scrollToMessage } = useMessageScroller();
  const { currentAnchorId, visibleMessageIds } = useMessageScrollerVisibility();
  const [hovered, setHovered] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const activeIndex = activeTickIndex(ticks, currentAnchorId, visibleMessageIds);
  const highlightIndex = hovered ?? activeIndex;

  const jumpTo = useCallback(
    (index: number) => {
      const tick = ticks[index];
      if (!tick) return;
      scrollToMessage(tick.id, {
        align: "center",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    },
    [ticks, scrollToMessage],
  );

  const indexAt = useCallback(
    (clientY: number) => {
      const el = trackRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return indexFromPointer(clientY, rect.top, rect.height, count);
    },
    [count],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Touch drags belong to the message scroller; a tap still lands on click.
      if (event.pointerType === "touch") return;
      setHovered(indexAt(event.clientY));
    },
    [indexAt],
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      jumpTo(indexAt(event.clientY));
    },
    [indexAt, jumpTo],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const current = hovered ?? activeIndex;
      let next: number;
      switch (event.key) {
        case "ArrowDown":
          next = Math.min(count - 1, current + 1);
          break;
        case "ArrowUp":
          next = Math.max(0, current - 1);
          break;
        case "PageDown":
          next = Math.min(count - 1, current + PAGE_JUMP);
          break;
        case "PageUp":
          next = Math.max(0, current - PAGE_JUMP);
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = count - 1;
          break;
        case "Enter":
        case " ":
          next = current;
          break;
        default:
          return;
      }
      event.preventDefault();
      setHovered(next);
      jumpTo(next);
    },
    [hovered, activeIndex, count, jumpTo],
  );

  if (count < 2) return null;

  const naturalSpan = (count - 1) * TICK_GAP;

  const previewTick = ticks[highlightIndex];
  const nearTop = highlightIndex <= 1;
  const nearBottom = highlightIndex >= count - 2;

  return (
    <div
      className="pointer-events-none absolute top-1/2 right-4 z-20 hidden w-6 -translate-y-1/2 items-center md:flex"
      style={{ height: `${MAX_HEIGHT_FRACTION * 100}%` }}
    >
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Message overview"
        aria-orientation="vertical"
        aria-valuemin={1}
        aria-valuemax={count}
        aria-valuenow={highlightIndex + 1}
        aria-valuetext={`Message ${highlightIndex + 1} of ${count}, ${previewTick?.role ?? "message"}`}
        className="focus-ring pointer-events-auto relative w-full cursor-pointer outline-none"
        style={{ height: `min(100%, ${naturalSpan}px)` }}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHovered(null)}
        onBlur={() => setHovered(null)}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {ticks.map((tick, index) => (
          <span
            key={tick.id}
            aria-hidden="true"
            style={{ top: `${(index / (count - 1)) * 100}%` }}
            className={cn(
              "absolute right-0 h-px -translate-y-1/2 rounded-full transition-colors duration-150",
              ROLE_WIDTH[tick.role],
              index === activeIndex
                ? "bg-(--lagoon)"
                : index === hovered
                  ? "bg-(--text-2)"
                  : "bg-(--text-3)/40",
            )}
          />
        ))}

        {hovered !== null && previewTick && (
          <div
            aria-hidden="true"
            className={cn(
              "glass pointer-events-none absolute right-full mr-3 w-56 rounded-lg px-3 py-2",
              nearTop ? "top-0" : nearBottom ? "bottom-0" : "top-1/2 -translate-y-1/2",
            )}
          >
            <div className="text-3 mb-1 flex items-center justify-between gap-2 text-[10px] tracking-widest uppercase">
              <span>{previewTick.role === "user" ? "You" : "Assistant"}</span>
              <span className="tabular-nums">
                {highlightIndex + 1}/{count}
              </span>
            </div>
            <p className="text-2 line-clamp-3 text-xs leading-5">{previewTick.preview || "…"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
