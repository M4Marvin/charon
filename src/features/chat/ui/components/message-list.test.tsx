// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ActivePathEntry } from "@/features/chat/tree/types";
import { MessageList } from "./message-list";

afterEach(cleanup);

function entry(localId: number, content: string): ActivePathEntry {
  return {
    message: {
      localId,
      parentLocalId: 0,
      children: [],
      selectedChildLocalId: null,
      role: "assistant",
      content,
    },
    siblingIndex: 0,
    siblingTotal: 1,
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
