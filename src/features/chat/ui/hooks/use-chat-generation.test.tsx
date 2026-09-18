// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useChatGeneration } from "./use-chat-generation";

const mocks = vi.hoisted(() => ({
  prepareStream: { mutateAsync: vi.fn() },
  finalizeStream: { mutateAsync: vi.fn() },
  cancelStream: { mutateAsync: vi.fn(async () => ({ deletedIds: [] })), mutate: vi.fn() },
  aiChat: {
    messages: [] as unknown[],
    setMessages: vi.fn(async () => {}),
    sendMessage: vi.fn(async () => {}),
    stop: vi.fn(),
  },
}));

vi.mock("@/hooks/useChats", () => ({
  usePrepareStream: () => mocks.prepareStream,
  useFinalizeStream: () => mocks.finalizeStream,
  useCancelStream: () => mocks.cancelStream,
}));

vi.mock("@tanstack/ai-react", () => ({
  useChat: () => mocks.aiChat,
  fetchServerSentEvents: () => ({}),
}));

vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useChatGeneration", () => {
  it("starts a stream when prepare resolves in time", async () => {
    mocks.prepareStream.mutateAsync.mockResolvedValueOnce({
      mode: "stream",
      assistantMessageLocalId: 7,
    });
    const { result } = renderHook(() => useChatGeneration("c1", null));

    await result.current.start("send", { content: "hi" });

    expect(mocks.aiChat.sendMessage).toHaveBeenCalledWith("hi");
    expect(mocks.cancelStream.mutateAsync).not.toHaveBeenCalled();
  });

  it("cancels a prepare that resolves after stop() and never streams", async () => {
    let resolvePrepare!: (value: unknown) => void;
    mocks.prepareStream.mutateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePrepare = resolve;
      }),
    );
    const { result } = renderHook(() => useChatGeneration("c1", null));

    const startPromise = result.current.start("send", { content: "hi" });
    result.current.stop();
    resolvePrepare({ mode: "stream", assistantMessageLocalId: 5 });
    await startPromise;

    await waitFor(() =>
      expect(mocks.cancelStream.mutateAsync).toHaveBeenCalledWith({
        chatId: "c1",
        messageLocalId: 5,
      }),
    );
    expect(mocks.aiChat.sendMessage).not.toHaveBeenCalled();
  });

  it("aborts the transport in stop()", () => {
    const { result } = renderHook(() => useChatGeneration("c1", null));
    result.current.stop();
    expect(mocks.aiChat.stop).toHaveBeenCalledTimes(1);
  });
});
