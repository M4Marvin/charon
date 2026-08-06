// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ChatUiState } from "@/features/chat/ui/chat-store";

// No vitest setup file / globals in this repo, so RTL auto-cleanup never runs.
afterEach(cleanup);

const mockOnSend = vi.fn();
const mockOnStop = vi.fn();
const mockOnImpersonate = vi.fn();
const mockOnImagePrompt = vi.fn();
const mockSetInputDraft = vi.fn();

const mockChatUiState = {
  inputDrafts: {},
  setInputDraft: mockSetInputDraft,
  composerFocusNonce: 0,
} satisfies Pick<ChatUiState, "inputDrafts" | "setInputDraft" | "composerFocusNonce">;

vi.mock("@/features/chat/ui/chat-store", () => ({
  useChatUiStore: (selector: (s: ChatUiState) => unknown) =>
    selector(mockChatUiState as unknown as ChatUiState),
  selectComposerFocusNonce: () => 0,
}));

import { Composer } from "./composer";

const baseProps = {
  chatId: "c1",
  hasMessages: true,
  onSend: mockOnSend,
  onStop: mockOnStop,
  onImpersonate: mockOnImpersonate,
  onImagePrompt: mockOnImagePrompt,
  isStreaming: false,
  impersonatePending: false,
  imagePromptPending: false,
  disabled: false,
  characterName: "Test Character",
};

describe("Composer image prompt button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no matchMedia; matches: true skips the coarse-pointer auto-focus effect.
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  });

  it("fires onImagePrompt when the Palette button is clicked", () => {
    render(<Composer {...baseProps} />);

    fireEvent.click(screen.getByLabelText("Generate image prompt"));

    expect(mockOnImagePrompt).toHaveBeenCalledTimes(1);
  });

  it("disables the button and swaps the icon for a spinner while imagePromptPending", () => {
    const { container } = render(<Composer {...baseProps} imagePromptPending />);

    expect((screen.getByLabelText("Generate image prompt") as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(container.querySelector('[data-slot="spinner"]')).not.toBeNull();
  });

  it("disables the button while streaming", () => {
    render(<Composer {...baseProps} isStreaming />);

    expect((screen.getByLabelText("Generate image prompt") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("keeps impersonate and send working (regression)", () => {
    render(<Composer {...baseProps} />);

    fireEvent.click(screen.getByLabelText("Impersonate"));
    fireEvent.click(screen.getByLabelText("Send message"));

    expect(mockOnImpersonate).toHaveBeenCalledTimes(1);
    expect(mockOnSend).toHaveBeenCalledTimes(1);
  });
});
