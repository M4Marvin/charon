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

const { mockToastInfo } = vi.hoisted(() => ({ mockToastInfo: vi.fn() }));
vi.mock("sonner", () => ({ toast: { info: mockToastInfo } }));

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

function getTextarea() {
  return screen.getByLabelText("Message") as HTMLTextAreaElement;
}

describe("Composer", () => {
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

  it("sends on plain Enter but not during IME composition", () => {
    render(<Composer {...baseProps} />);

    fireEvent.keyDown(getTextarea(), { key: "Enter" });
    expect(mockOnSend).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(getTextarea(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(getTextarea(), { key: "Enter", keyCode: 229 });
    expect(mockOnSend).toHaveBeenCalledTimes(1);
  });

  it("ignores repeated Enter and modifier combos", () => {
    render(<Composer {...baseProps} />);

    fireEvent.keyDown(getTextarea(), { key: "Enter", repeat: true });
    fireEvent.keyDown(getTextarea(), { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(getTextarea(), { key: "Enter", metaKey: true });
    fireEvent.keyDown(getTextarea(), { key: "Enter", altKey: true });

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it("stops generation on Enter while streaming and says so in the placeholder", () => {
    render(<Composer {...baseProps} isStreaming />);

    expect(getTextarea().placeholder).toContain("stop");

    fireEvent.keyDown(getTextarea(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(getTextarea(), { key: "Enter", keyCode: 229 });
    expect(mockOnStop).not.toHaveBeenCalled();

    fireEvent.keyDown(getTextarea(), { key: "Enter" });

    expect(mockOnStop).toHaveBeenCalledTimes(1);
    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it("shows a disabled pending stop control while finalizing", () => {
    const { container } = render(<Composer {...baseProps} isStreaming isFinalizing />);

    const stop = screen.getByLabelText("Stopping generation") as HTMLButtonElement;
    expect(stop.disabled).toBe(true);
    expect(container.querySelector('[data-slot="spinner"]')).not.toBeNull();
    expect(getTextarea().placeholder).toContain("Finishing");
  });

  it("keeps the draft editable when sending is blocked", () => {
    render(<Composer {...baseProps} disabled />);

    fireEvent.change(getTextarea(), { target: { value: "draft" } });

    expect(getTextarea().disabled).toBe(false);
    expect(mockSetInputDraft).toHaveBeenCalledWith("c1", "draft");
    expect((screen.getByLabelText("Send message") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.keyDown(getTextarea(), { key: "Enter" });
    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it("warns instead of silently swallowing dropped images", () => {
    render(<Composer {...baseProps} />);

    fireEvent.drop(getTextarea(), {
      dataTransfer: {
        types: ["Files"],
        files: [new File(["x"], "image.png", { type: "image/png" })],
      },
    });

    expect(mockToastInfo).toHaveBeenCalledWith(
      "Images aren't supported in the composer — use the scene panel",
    );
  });
});
