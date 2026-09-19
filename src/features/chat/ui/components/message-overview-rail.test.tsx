// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ActivePathEntry } from "@/features/chat/tree/types";
import { MessageOverviewRail } from "./message-overview-rail";

const mocks = vi.hoisted(() => ({
  scrollToMessage: vi.fn(),
  visibility: { currentAnchorId: null as string | null, visibleMessageIds: [] as string[] },
}));

vi.mock("@/components/ui/message-scroller", () => ({
  useMessageScroller: () => ({ scrollToMessage: mocks.scrollToMessage }),
  useMessageScrollerVisibility: () => mocks.visibility,
}));

beforeEach(() => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.visibility.currentAnchorId = null;
  mocks.visibility.visibleMessageIds = [];
});

function entry(localId: number, role: "user" | "assistant", content: string): ActivePathEntry {
  return {
    message: {
      localId,
      parentLocalId: 0,
      children: [],
      selectedChildLocalId: null,
      role,
      content,
    },
    siblingIndex: 0,
    siblingTotal: 1,
  };
}

const entries = [
  entry(1, "assistant", "greeting"),
  entry(2, "user", "hello there"),
  entry(3, "assistant", "reply"),
];

function stubRect(el: Element) {
  el.getBoundingClientRect = () =>
    ({ top: 100, height: 200, left: 0, right: 24, width: 24, bottom: 300 }) as DOMRect;
}

describe("MessageOverviewRail", () => {
  it("renders nothing for a single message", () => {
    const { container } = render(<MessageOverviewRail entries={[entry(1, "assistant", "hi")]} />);
    expect(container.querySelector('[role="slider"]')).toBeNull();
  });

  it("exposes the message count and the active message on the slider", () => {
    mocks.visibility.currentAnchorId = "2";
    render(<MessageOverviewRail entries={entries} />);
    const slider = screen.getByRole("slider");
    expect(slider.getAttribute("aria-valuemax")).toBe("3");
    expect(slider.getAttribute("aria-valuenow")).toBe("2");
    expect(slider.getAttribute("aria-orientation")).toBe("vertical");
    expect(slider.getAttribute("aria-valuetext")).toBe("Message 2 of 3, user");
  });

  it("jumps to the pointer position on click", () => {
    render(<MessageOverviewRail entries={entries} />);
    const slider = screen.getByRole("slider");
    stubRect(slider);

    fireEvent.click(slider, { clientY: 300 });

    expect(mocks.scrollToMessage).toHaveBeenCalledWith("3", {
      align: "center",
      behavior: "smooth",
    });
  });

  it("moves and jumps with the keyboard from the active message", () => {
    mocks.visibility.currentAnchorId = "1";
    render(<MessageOverviewRail entries={entries} />);
    const slider = screen.getByRole("slider");

    fireEvent.keyDown(slider, { key: "ArrowDown" });
    expect(mocks.scrollToMessage).toHaveBeenCalledWith("2", {
      align: "center",
      behavior: "smooth",
    });
    expect(slider.getAttribute("aria-valuenow")).toBe("2");

    fireEvent.keyDown(slider, { key: "End" });
    expect(mocks.scrollToMessage).toHaveBeenLastCalledWith("3", {
      align: "center",
      behavior: "smooth",
    });
    expect(slider.getAttribute("aria-valuenow")).toBe("3");

    fireEvent.keyDown(slider, { key: "Home" });
    expect(mocks.scrollToMessage).toHaveBeenLastCalledWith("1", {
      align: "center",
      behavior: "smooth",
    });
  });

  it("shows a message preview on mouse hover", () => {
    render(<MessageOverviewRail entries={entries} />);
    const slider = screen.getByRole("slider");
    stubRect(slider);

    fireEvent.pointerMove(slider, { clientY: 200, pointerType: "mouse" });

    expect(screen.getByText("hello there")).not.toBeNull();
    expect(screen.getByText("You")).not.toBeNull();
    expect(screen.getByText("2/3")).not.toBeNull();
  });

  it("ignores touch pointer movement so taps still scroll", () => {
    render(<MessageOverviewRail entries={entries} />);
    const slider = screen.getByRole("slider");
    stubRect(slider);

    fireEvent.pointerMove(slider, { clientY: 200, pointerType: "touch" });

    expect(screen.queryByText("hello there")).toBeNull();
  });

  it("honours reduced motion", () => {
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    render(<MessageOverviewRail entries={entries} />);
    const slider = screen.getByRole("slider");
    stubRect(slider);

    fireEvent.click(slider, { clientY: 100 });

    expect(mocks.scrollToMessage).toHaveBeenCalledWith("1", {
      align: "center",
      behavior: "auto",
    });
  });
});
