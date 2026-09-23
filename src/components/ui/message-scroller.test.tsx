// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "./message-scroller";

afterEach(cleanup);

type Row = {
  id: string;
  top: number;
  anchor: boolean;
};

const INITIAL_ROWS: Row[] = [
  { id: "user-1", top: 0, anchor: true },
  { id: "assistant-1", top: 50, anchor: false },
  { id: "user-2", top: 100, anchor: true },
];

const PENDING_ROWS: Row[] = [
  ...INITIAL_ROWS,
  { id: "pending-user", top: 150, anchor: true },
  { id: "pending-assistant", top: 200, anchor: false },
];

const CONFIRMED_ROWS: Row[] = [
  ...INITIAL_ROWS,
  { id: "user-3", top: 150, anchor: true },
  { id: "assistant-2", top: 200, anchor: false },
];

function rect(top: number, height: number): DOMRect {
  return {
    x: 0,
    y: top,
    width: 100,
    height,
    top,
    bottom: top + height,
    left: 0,
    right: 100,
    toJSON: () => ({}),
  };
}

function Transcript({
  viewportRef,
  rows,
}: {
  viewportRef: (element: HTMLDivElement | null) => void;
  rows: Row[];
}) {
  return (
    <MessageScrollerProvider
      autoScroll
      defaultScrollPosition="last-anchor"
      scrollEdgeThreshold={80}
      scrollPreviousItemPeek={0}
    >
      <MessageScroller>
        <MessageScrollerViewport ref={viewportRef}>
          <MessageScrollerContent>
            {rows.map((row) => (
              <MessageScrollerItem
                key={row.id}
                messageId={row.id}
                scrollAnchor={row.anchor}
                ref={(element) => {
                  if (!element) return;
                  const content = element.closest<HTMLElement>('[role="log"]');
                  const viewport = content?.parentElement;
                  element.getBoundingClientRect = () =>
                    rect(row.top - (viewport?.scrollTop ?? 0), 40);
                }}
              />
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

describe("MessageScroller anchor handoff", () => {
  it("does not re-anchor to history when a pending row becomes the confirmed row", async () => {
    const viewportRef: { current: HTMLDivElement | null } = { current: null };
    const scrollCalls: number[] = [];
    const setViewportRef = (element: HTMLDivElement | null) => {
      viewportRef.current = element;
      if (!element) return;

      element.scrollTop = 50;
      element.getBoundingClientRect = () => rect(0, 100);
      Object.defineProperties(element, {
        clientHeight: { configurable: true, value: 100 },
        scrollHeight: {
          configurable: true,
          get: () => element.querySelectorAll("[data-message-id]").length * 50,
        },
      });
      element.scrollTo = vi.fn((options?: ScrollToOptions | number, y?: number) => {
        const top =
          typeof options === "number" ? options : (options?.top ?? y ?? element.scrollTop);
        element.scrollTop = top;
        scrollCalls.push(top);
      }) as typeof element.scrollTo;
    };

    const { rerender } = render(<Transcript viewportRef={setViewportRef} rows={INITIAL_ROWS} />);
    const viewport = viewportRef.current;
    if (!viewport) throw new Error("MessageScroller viewport did not mount");

    rerender(<Transcript viewportRef={setViewportRef} rows={PENDING_ROWS} />);
    await waitFor(() => expect(scrollCalls).toContain(150));
    scrollCalls.length = 0;
    viewport.scrollTop = 140;

    rerender(<Transcript viewportRef={setViewportRef} rows={CONFIRMED_ROWS} />);
    await waitFor(() => expect(scrollCalls).toHaveLength(1));

    expect(scrollCalls).toEqual([150]);
  });
});
