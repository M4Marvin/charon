// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getChatMessages } from "@/server/fns/chats";
import { getChatConfigFn } from "@/features/chat/config/fns";
import type { ChatListItem } from "@/server/fns/chats";
import { chatKeys } from "@/hooks/useChats";
import { chatConfigKeys } from "@/hooks/useChatConfig";
import { ChatRow } from "./chat-row";

afterEach(cleanup);

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/server/fns/chats", () => ({ getChatMessages: vi.fn(async () => []) }));
vi.mock("@/features/chat/config/fns", () => ({ getChatConfigFn: vi.fn(async () => ({})) }));

const chat: ChatListItem = {
  id: "chat-1",
  characterId: "char-1",
  title: "Test Chat",
  characterName: "Test Character",
  characterImagePath: null,
  lastMessagePreview: null,
  userMessageCount: 2,
  backgroundId: null,
  characterDescription: "",
  characterPersonality: "",
  characterScenario: "",
  characterSystemPrompt: "",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ChatRow prefetch", () => {
  it("warms the messages and config queries on hover", async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ChatRow chat={chat} onRename={() => {}} onDelete={() => {}} />
      </QueryClientProvider>,
    );

    fireEvent.mouseEnter(screen.getByText("Test Chat"));

    expect(getChatMessages).toHaveBeenCalledTimes(1);
    expect(getChatConfigFn).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(queryClient.getQueryData(chatKeys.messages("chat-1"))).toEqual([]);
      expect(queryClient.getQueryData(chatConfigKeys.detail("chat-1"))).toEqual({});
    });
  });
});
