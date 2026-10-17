// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ActivePathEntry } from "@/features/chat/tree/types";
import { MessageList } from "./message-list";

afterEach(cleanup);

function entry(
  localId: number,
  content: string,
  overrides: Partial<Pick<ActivePathEntry, "siblingIndex" | "siblingTotal">> & {
    role?: "user" | "assistant";
  } = {},
): ActivePathEntry {
  const { role = "assistant", ...siblings } = overrides;
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
    ...siblings,
  };
}

const baseProps = {
  activePlaceholderId: null as number | null,
  streamingText: "",
  characterName: "Test Character",
  userName: "Test User",
  characterAvatarSrc: null,
  userAvatarSrc: null,
  disabled: false,
  onSwipe: () => {},
  onRegenerate: () => {},
  onEdit: () => {},
  onDelete: () => {},
  pendingUserContent: null as string | null,
  showPendingAssistant: false,
};

describe("MessageList pending overlay", () => {
  it("renders the pending user bubble alongside history", () => {
    render(
      <MessageList
        {...baseProps}
        entries={[entry(1, "hello there")]}
        pendingUserContent="my instant message"
        showPendingAssistant
      />,
    );
    expect(screen.getByText("my instant message")).not.toBeNull();
    expect(screen.getByText("hello there")).not.toBeNull();
    expect(screen.getByText("Message sent.")).not.toBeNull();
    expect(screen.getByText("Assistant is responding.")).not.toBeNull();
  });

  it("keeps live-region status nodes outside the scroller content", () => {
    const { container } = render(
      <MessageList
        {...baseProps}
        entries={[entry(1, "hello there")]}
        pendingUserContent="my instant message"
        showPendingAssistant
      />,
    );
    const content = container.querySelector<HTMLElement>('[data-slot="message-scroller-content"]');

    expect(content).not.toBeNull();
    if (!content) return;

    expect(content.contains(screen.getByText("Message sent."))).toBe(false);
    expect(content.contains(screen.getByText("Assistant is responding."))).toBe(false);

    const transcriptChildren = Array.from(content.children).filter(
      (child) =>
        !(child instanceof HTMLElement && child.hasAttribute("data-message-scroller-spacer")),
    );
    expect(transcriptChildren).toHaveLength(3);
    expect(
      transcriptChildren.every(
        (child) => child.getAttribute("data-slot") === "message-scroller-item",
      ),
    ).toBe(true);
  });

  it("renders an inert overlay with typing dots and no actions", () => {
    const { container } = render(
      <MessageList
        {...baseProps}
        entries={[]}
        pendingUserContent="first message"
        showPendingAssistant
      />,
    );

    expect(screen.getByText("first message")).not.toBeNull();
    expect(container.querySelector(".animate-bounce")).not.toBeNull();
    // Synthetic entries must not expose destructive/interactive controls.
    expect(screen.queryByLabelText("Delete message")).toBeNull();
    expect(screen.queryByLabelText("Edit message")).toBeNull();
    expect(screen.queryByLabelText("Copy message")).toBeNull();
  });

  it("renders nothing pending by default", () => {
    const { container } = render(<MessageList {...baseProps} entries={[entry(1, "hello")]} />);
    expect(screen.queryByText("hello")).not.toBeNull();
    // Typing dots only come from the pending/streaming placeholder.
    expect(container.querySelector(".animate-bounce")).toBeNull();
  });
});

describe("assistant message actions", () => {
  it("shows regenerate only on the newest assistant message", () => {
    render(
      <MessageList
        {...baseProps}
        entries={[
          entry(1, "first reply"),
          entry(2, "a user message", { role: "user" }),
          entry(3, "second reply"),
        ]}
      />,
    );
    expect(screen.getAllByLabelText("Regenerate response")).toHaveLength(1);
  });

  it("shows next and regenerate together on the newest assistant with forward siblings", () => {
    render(
      <MessageList
        {...baseProps}
        entries={[entry(1, "a branched reply", { siblingIndex: 0, siblingTotal: 3 })]}
      />,
    );
    expect(screen.queryByLabelText("Next response")).not.toBeNull();
    expect(screen.queryByLabelText("Regenerate response")).not.toBeNull();
  });

  it("keeps swiping but drops regenerate on a mid-history assistant", () => {
    render(
      <MessageList
        {...baseProps}
        entries={[
          entry(1, "an older reply", { siblingIndex: 0, siblingTotal: 2 }),
          entry(2, "a user message", { role: "user" }),
          entry(3, "the newest reply"),
        ]}
      />,
    );
    const item = screen
      .getByText("an older reply")
      .closest('[data-slot="message-scroller-item"]') as HTMLElement | null;
    expect(item).not.toBeNull();
    expect(within(item as HTMLElement).queryByLabelText("Next response")).not.toBeNull();
    expect(within(item as HTMLElement).queryByLabelText("Regenerate response")).toBeNull();
  });
});
