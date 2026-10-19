// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useChatUiStore } from "../chat-store";
import { useGenerationChat } from "./use-generation-chat";

interface CapturedOptions {
  onFinish?: () => void;
  onError?: (error: unknown) => void;
  onChunk?: (chunk: unknown) => void;
}

const mocks = vi.hoisted(() => ({
  options: { current: null as CapturedOptions | null },
  sendMessage: vi.fn(async () => {}),
  stop: vi.fn(),
  prepare: vi.fn(),
  cancel: vi.fn(async () => ({ ok: true })),
  toastError: vi.fn(),
}));

vi.mock("@tanstack/ai-react", () => ({
  fetchServerSentEvents: vi.fn(() => ({})),
  useChat: vi.fn((options: CapturedOptions) => {
    mocks.options.current = options;
    return { sendMessage: mocks.sendMessage, stop: mocks.stop };
  }),
}));

vi.mock("@/features/generation/fns", () => ({
  prepareGenerationFn: mocks.prepare,
  cancelGenerationFn: mocks.cancel,
}));

vi.mock("@/hooks/useChats", () => ({
  chatKeys: { messages: (chatId: string) => ["messages", chatId] },
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  useChatUiStore.setState({ activePlaceholderId: null, pendingSend: null });
  mocks.options.current = null;
  mocks.prepare.mockResolvedValue({ jobId: "job-1", placeholderLocalId: 7, userLocalId: 1 });
  mocks.sendMessage.mockClear();
  mocks.stop.mockClear();
  mocks.cancel.mockClear();
  mocks.toastError.mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useGenerationChat", () => {
  it("clears the pending overlay and owned placeholder on finish", async () => {
    const { result } = renderHook(() => useGenerationChat("chat-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.start("send", { content: "hello" });
    });

    expect(useChatUiStore.getState().pendingSend).toEqual({
      chatId: "chat-1",
      content: "hello",
    });
    expect(useChatUiStore.getState().activePlaceholderId).toBe(7);

    act(() => mocks.options.current?.onFinish?.());

    expect(useChatUiStore.getState().pendingSend).toBeNull();
    expect(useChatUiStore.getState().activePlaceholderId).toBeNull();
  });

  it("cancels a prepared job when stop happens during prepare", async () => {
    let resolvePrepare!: (value: {
      jobId: string;
      placeholderLocalId: number;
      userLocalId: number;
    }) => void;
    mocks.prepare.mockReturnValue(
      new Promise((resolve) => {
        resolvePrepare = resolve;
      }),
    );

    const { result } = renderHook(() => useGenerationChat("chat-1"), {
      wrapper: createWrapper(),
    });

    let startPromise: Promise<void> | undefined;
    act(() => {
      startPromise = result.current.start("send", { content: "hello" });
    });
    act(() => result.current.stop());

    await act(async () => {
      resolvePrepare({ jobId: "job-2", placeholderLocalId: 8, userLocalId: 2 });
      await startPromise;
    });

    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(mocks.cancel).toHaveBeenCalledWith({ data: { jobId: "job-2" } });
    expect(useChatUiStore.getState().pendingSend).toBeNull();
    expect(useChatUiStore.getState().activePlaceholderId).toBeNull();
  });

  it("clears run state and cancels on error", async () => {
    const { result } = renderHook(() => useGenerationChat("chat-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.start("send", { content: "hello" });
    });

    act(() => mocks.options.current?.onError?.(new Error("boom")));

    expect(mocks.toastError).toHaveBeenCalled();
    expect(useChatUiStore.getState().pendingSend).toBeNull();
    expect(useChatUiStore.getState().activePlaceholderId).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });
});
