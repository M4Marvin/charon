import { beforeEach, describe, expect, it } from "vitest";
import { useChatUiStore } from "./chat-store";
import { clearGenerationOverlay } from "./generation-overlay";

describe("clearGenerationOverlay", () => {
  beforeEach(() => {
    useChatUiStore.setState({ activePlaceholderId: null, pendingSend: null });
  });

  it("clears the pending bubble and this run's placeholder", () => {
    useChatUiStore.setState({
      activePlaceholderId: 7,
      pendingSend: { chatId: "c1", content: "hello" },
    });

    clearGenerationOverlay("c1", 7);

    expect(useChatUiStore.getState().activePlaceholderId).toBeNull();
    expect(useChatUiStore.getState().pendingSend).toBeNull();
  });

  it("clears pending after the placeholder has already gone", () => {
    useChatUiStore.setState({
      activePlaceholderId: null,
      pendingSend: { chatId: "c1", content: "hello" },
    });

    clearGenerationOverlay("c1", 7);

    expect(useChatUiStore.getState().pendingSend).toBeNull();
  });

  it("does not clear another run's placeholder or pending chat", () => {
    useChatUiStore.setState({
      activePlaceholderId: 9,
      pendingSend: { chatId: "c2", content: "other" },
    });

    clearGenerationOverlay("c1", 7);

    expect(useChatUiStore.getState().activePlaceholderId).toBe(9);
    expect(useChatUiStore.getState().pendingSend).toEqual({ chatId: "c2", content: "other" });
  });
});
