// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useChatGeneration } from "./use-chat-generation";
import { useChatUiStore } from "../chat-store";
import { toast } from "sonner";

const mocks = vi.hoisted(() => ({
  prepareStream: { mutateAsync: vi.fn() },
  finalizeStream: { mutateAsync: vi.fn() },
  cancelStream: { mutateAsync: vi.fn(async () => ({ deletedIds: [] })), mutate: vi.fn() },
  aiChat: {
    messages: [] as unknown[],
    setMessages: vi.fn(async () => {}),
    sendMessage: vi.fn(async () => {}),
    stop: vi.fn(),
    options: {} as { onFinish: () => void; onError: (err: unknown) => void },
  },
}));

vi.mock("@/hooks/useChats", () => ({
  usePrepareStream: () => mocks.prepareStream,
  useFinalizeStream: () => mocks.finalizeStream,
  useCancelStream: () => mocks.cancelStream,
}));

vi.mock("@tanstack/ai-react", () => ({
  useChat: (opts: { onFinish: () => void; onError: (err: unknown) => void }) => {
    mocks.aiChat.options = opts;
    return mocks.aiChat;
  },
  fetchServerSentEvents: () => ({}),
}));

vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.aiChat.messages = [];
  useChatUiStore.setState({ activePlaceholderId: null, pendingSend: null });
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

  it("a stream error is reported to the user", () => {
    renderHook(() => useChatGeneration("c1", null));

    act(() => {
      mocks.aiChat.options.onError(new Error("boom"));
    });

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Generation failed");
  });

  it("aborts the transport in stop()", () => {
    const { result } = renderHook(() => useChatGeneration("c1", null));
    result.current.stop();
    expect(mocks.aiChat.stop).toHaveBeenCalledTimes(1);
  });

  it("unmount clears placeholder and pending overlay", async () => {
    mocks.prepareStream.mutateAsync.mockResolvedValueOnce({
      mode: "stream",
      assistantMessageLocalId: 7,
    });
    const { result, unmount } = renderHook(() => useChatGeneration("c1", null));

    await result.current.start("send", { content: "hi" });
    expect(useChatUiStore.getState().activePlaceholderId).toBe(7);
    expect(useChatUiStore.getState().pendingSend).toEqual({ chatId: "c1", content: "hi" });

    unmount();

    expect(useChatUiStore.getState().activePlaceholderId).toBeNull();
    expect(useChatUiStore.getState().pendingSend).toBeNull();
  });

  it("unmount during finalizing does not cancel the placeholder", async () => {
    mocks.prepareStream.mutateAsync.mockResolvedValueOnce({
      mode: "stream",
      assistantMessageLocalId: 7,
    });
    const { result, unmount } = renderHook(() => useChatGeneration("c1", null));
    await result.current.start("send", { content: "hi" });

    let resolveFinalize!: (value: unknown) => void;
    mocks.finalizeStream.mutateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFinalize = resolve;
      }),
    );
    mocks.aiChat.messages = [{ role: "assistant", parts: [{ type: "text", content: "done" }] }];
    act(() => {
      mocks.aiChat.options.onFinish();
    });

    await waitFor(() =>
      expect(mocks.finalizeStream.mutateAsync).toHaveBeenCalledWith({
        chatId: "c1",
        messageLocalId: 7,
        content: "done",
      }),
    );

    unmount();

    expect(mocks.cancelStream.mutate).not.toHaveBeenCalled();
    expect(mocks.cancelStream.mutateAsync).not.toHaveBeenCalled();
    expect(useChatUiStore.getState().activePlaceholderId).toBe(7);

    await act(async () => {
      resolveFinalize({ messageLocalId: 7, content: "done" });
    });

    expect(useChatUiStore.getState().activePlaceholderId).toBeNull();
    expect(useChatUiStore.getState().pendingSend).toBeNull();
  });

  it("a stale continuation does not clear a newer run's overlay", async () => {
    mocks.prepareStream.mutateAsync.mockResolvedValueOnce({
      mode: "stream",
      assistantMessageLocalId: 7,
    });
    const { result } = renderHook(() => useChatGeneration("c1", null));
    await result.current.start("send", { content: "hi" });

    let resolveFinalize!: (value: unknown) => void;
    mocks.finalizeStream.mutateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFinalize = resolve;
      }),
    );
    mocks.aiChat.messages = [{ role: "assistant", parts: [{ type: "text", content: "done" }] }];
    act(() => {
      mocks.aiChat.options.onFinish();
    });

    await waitFor(() =>
      expect(mocks.finalizeStream.mutateAsync).toHaveBeenCalledWith({
        chatId: "c1",
        messageLocalId: 7,
        content: "done",
      }),
    );

    useChatUiStore.getState().setPlaceholder(99);
    useChatUiStore.getState().setPendingSend({ chatId: "c2", content: "other" });

    await act(async () => {
      resolveFinalize({ messageLocalId: 7, content: "done" });
    });

    expect(useChatUiStore.getState().activePlaceholderId).toBe(99);
    expect(useChatUiStore.getState().pendingSend).toEqual({ chatId: "c2", content: "other" });
  });

  it("finalizes on the chat the run started for after the route param changes", async () => {
    mocks.prepareStream.mutateAsync.mockResolvedValueOnce({
      mode: "stream",
      assistantMessageLocalId: 7,
    });
    mocks.finalizeStream.mutateAsync.mockResolvedValueOnce({ messageLocalId: 7, content: "done" });
    const { result, rerender } = renderHook(({ id }) => useChatGeneration(id, null), {
      initialProps: { id: "c1" },
    });

    await result.current.start("send", { content: "hi" });
    expect(useChatUiStore.getState().activePlaceholderId).toBe(7);

    // The route param moves on while the run is still live.
    rerender({ id: "c2" });

    mocks.aiChat.messages = [{ role: "assistant", parts: [{ type: "text", content: "done" }] }];
    act(() => {
      mocks.aiChat.options.onFinish();
    });

    await waitFor(() =>
      expect(mocks.finalizeStream.mutateAsync).toHaveBeenCalledWith({
        chatId: "c1",
        messageLocalId: 7,
        content: "done",
      }),
    );
  });

  it("a prepare that resolves after unmount is cancelled, not streamed", async () => {
    let resolvePrepare!: (value: unknown) => void;
    mocks.prepareStream.mutateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePrepare = resolve;
      }),
    );
    const { result, unmount } = renderHook(() => useChatGeneration("c1", null));

    const startPromise = result.current.start("send", { content: "hi" });
    unmount();
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

  it("stop() is a no-op while finalizing", async () => {
    mocks.prepareStream.mutateAsync.mockResolvedValueOnce({
      mode: "stream",
      assistantMessageLocalId: 7,
    });
    const { result } = renderHook(() => useChatGeneration("c1", null));
    await result.current.start("send", { content: "hi" });

    let resolveFinalize!: (value: unknown) => void;
    mocks.finalizeStream.mutateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFinalize = resolve;
      }),
    );
    mocks.aiChat.messages = [{ role: "assistant", parts: [{ type: "text", content: "done" }] }];
    act(() => {
      mocks.aiChat.options.onFinish();
    });

    await waitFor(() =>
      expect(mocks.finalizeStream.mutateAsync).toHaveBeenCalledWith({
        chatId: "c1",
        messageLocalId: 7,
        content: "done",
      }),
    );

    result.current.stop();

    expect(mocks.cancelStream.mutate).not.toHaveBeenCalled();
    expect(mocks.cancelStream.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.aiChat.stop).not.toHaveBeenCalled();

    await act(async () => {
      resolveFinalize({ messageLocalId: 7, content: "done" });
    });
  });
});
