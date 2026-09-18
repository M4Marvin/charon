// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getChatMessages } from "@/server/fns/chats";
import { getChatConfigFn } from "@/features/chat/config/fns";
import type { ChatListItem } from "@/server/fns/chats";
import { ChatRow } from "./chat-row";

afterEach(cleanup);

vi.mock("@tanstack/react-router", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock("@/server/fns/chats", () => ({ getChatMessages: vi.fn(async () => []) }));
vi.mock("@/features/chat/config/fns", () => ({ getChatConfigFn: vi.fn(async () => ({})) }));

const chat = {
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
} as unknown as ChatListItem;

describe("ChatRow prefetch", () => {
  it("prefetches messages + config on hover", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ChatRow chat={chat} onRename={() => {}} onDelete={() => {}} />
      </QueryClientProvider>,
    );
    fireEvent.mouseEnter(screen.getByText("Test Chat"));
    expect(getChatMessages).toHaveBeenCalledTimes(1);
    expect(getChatConfigFn).toHaveBeenCalledTimes(1);
  });
});
