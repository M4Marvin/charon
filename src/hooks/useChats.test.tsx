// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ChatMessageRow } from "@/db/schema";
import { deleteBranchFn, editMessageFn, swipeFn } from "@/features/chat/tree/fns";
import { chatKeys, useDeleteMessage, useEditMessage, useSwipeMessage } from "./useChats";

vi.mock("@/server/fns/chats", () => ({
  createChat: vi.fn(),
  deleteChat: vi.fn(),
  getChat: vi.fn(),
  getChatMessages: vi.fn(async () => []),
  listChats: vi.fn(async () => []),
  listChatsByCharacter: vi.fn(async () => []),
  updateChatSettings: vi.fn(),
}));

vi.mock("@/features/chat/generation/fns", () => ({
  cancelStreamFn: vi.fn(),
  finalizeStreamFn: vi.fn(),
  imagePromptFn: vi.fn(),
  impersonateFn: vi.fn(),
  prepareStreamFn: vi.fn(),
}));

vi.mock("@/features/chat/tree/fns", () => ({
  appendUserAndReplyFn: vi.fn(),
  deleteBranchFn: vi.fn(),
  editMessageFn: vi.fn(),
  swipeFn: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function row(partial: Partial<ChatMessageRow> & { localId: number }): ChatMessageRow {
  return {
    chatId: "c1",
    parentLocalId: null,
    children: [],
    selectedChildLocalId: null,
    role: "assistant",
    content: "",
    extra: null,
    ...partial,
  };
}

function siblingRows(): ChatMessageRow[] {
  return [
    row({ localId: 0, role: "system", children: [1, 2], selectedChildLocalId: 1 }),
    row({ localId: 1, parentLocalId: 0, content: "first" }),
    row({ localId: 2, parentLocalId: 0, content: "second" }),
  ];
}

function setup(initial?: ChatMessageRow[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (initial) queryClient.setQueryData(chatKeys.messages("c1"), initial);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper, key: chatKeys.messages("c1") };
}

function messages(queryClient: QueryClient, key: readonly unknown[]) {
  return queryClient.getQueryData<ChatMessageRow[]>(key);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useEditMessage", () => {
  it("writes the new content to the messages cache before the server resolves", async () => {
    const { queryClient, wrapper, key } = setup(siblingRows());
    const pending = deferred<unknown>();
    vi.mocked(editMessageFn).mockReturnValueOnce(pending.promise as never);

    const { result } = renderHook(() => useEditMessage(), { wrapper });
    const mutation = result.current.mutateAsync({
      chatId: "c1",
      messageLocalId: 1,
      content: "edited",
    });

    await waitFor(() =>
      expect(messages(queryClient, key)?.find((r) => r.localId === 1)?.content).toBe("edited"),
    );

    pending.resolve(undefined);
    await mutation;
  });

  it("restores the previous rows when the mutation fails", async () => {
    const previous = siblingRows();
    const { queryClient, wrapper, key } = setup(previous);
    vi.mocked(editMessageFn).mockRejectedValueOnce(new Error("nope"));

    const { result } = renderHook(() => useEditMessage(), { wrapper });
    await expect(
      result.current.mutateAsync({ chatId: "c1", messageLocalId: 1, content: "edited" }),
    ).rejects.toThrow("nope");

    await waitFor(() =>
      expect(messages(queryClient, key)?.find((r) => r.localId === 1)?.content).toBe("first"),
    );
  });

  it("does not let an older failed edit clobber a newer optimistic edit", async () => {
    const { queryClient, wrapper, key } = setup(siblingRows());
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    vi.mocked(editMessageFn)
      .mockReturnValueOnce(first.promise as never)
      .mockReturnValueOnce(second.promise as never);

    const { result } = renderHook(() => useEditMessage(), { wrapper });
    const firstMutation = result.current.mutateAsync({
      chatId: "c1",
      messageLocalId: 1,
      content: "first edit",
    });
    await waitFor(() =>
      expect(messages(queryClient, key)?.find((r) => r.localId === 1)?.content).toBe("first edit"),
    );

    const secondMutation = result.current.mutateAsync({
      chatId: "c1",
      messageLocalId: 1,
      content: "second edit",
    });
    await waitFor(() =>
      expect(messages(queryClient, key)?.find((r) => r.localId === 1)?.content).toBe("second edit"),
    );

    // Older mutation fails after the newer one has taken ownership.
    first.reject(new Error("stale failure"));
    await expect(firstMutation).rejects.toThrow("stale failure");
    expect(messages(queryClient, key)?.find((r) => r.localId === 1)?.content).toBe("second edit");

    second.resolve(undefined);
    await secondMutation;
  });
});

describe("useSwipeMessage", () => {
  it("flips the parent selection optimistically and rolls back on failure", async () => {
    const { queryClient, wrapper, key } = setup(siblingRows());
    const pending = deferred<unknown>();
    vi.mocked(swipeFn).mockReturnValueOnce(pending.promise as never);

    const { result } = renderHook(() => useSwipeMessage(), { wrapper });
    const mutation = result.current.mutateAsync({
      chatId: "c1",
      messageLocalId: 1,
      direction: "next",
    });
    await waitFor(() =>
      expect(messages(queryClient, key)?.find((r) => r.localId === 0)?.selectedChildLocalId).toBe(
        2,
      ),
    );

    pending.reject(new Error("busy"));
    await expect(mutation).rejects.toThrow("busy");
    await waitFor(() =>
      expect(messages(queryClient, key)?.find((r) => r.localId === 0)?.selectedChildLocalId).toBe(
        1,
      ),
    );
  });
});

describe("useDeleteMessage", () => {
  it("removes the subtree optimistically and rolls back on failure", async () => {
    const { queryClient, wrapper, key } = setup(siblingRows());
    const pending = deferred<unknown>();
    vi.mocked(deleteBranchFn).mockReturnValueOnce(pending.promise as never);

    const { result } = renderHook(() => useDeleteMessage(), { wrapper });
    const mutation = result.current.mutateAsync({ chatId: "c1", messageLocalId: 1 });
    await waitFor(() => expect(messages(queryClient, key)).toHaveLength(2));

    pending.reject(new Error("busy"));
    await expect(mutation).rejects.toThrow("busy");
    await waitFor(() => expect(messages(queryClient, key)).toHaveLength(3));
  });
});
