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
  Link: ({
    children,
    to: _to,
    params: _params,
    ...props
  }: React.ComponentProps<"a"> & { to?: string; params?: Record<string, string> }) => (
    <a href="#" {...props}>
      {children}
    </a>
  ),
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

function renderRow(overrides: Partial<ChatListItem> = {}) {
  const queryClient = new QueryClient();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <ChatRow chat={{ ...chat, ...overrides }} onRename={() => {}} onDelete={() => {}} />
    </QueryClientProvider>,
  );
  return { queryClient, ...result };
}

describe("ChatRow prefetch", () => {
  it("warms the messages and config queries on hover", async () => {
    const { queryClient } = renderRow();

    fireEvent.mouseEnter(screen.getByText("Test Chat"));

    expect(getChatMessages).toHaveBeenCalledTimes(1);
    expect(getChatConfigFn).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(queryClient.getQueryData(chatKeys.messages("chat-1"))).toEqual([]);
      expect(queryClient.getQueryData(chatConfigKeys.detail("chat-1"))).toEqual({});
    });
  });
});

describe("ChatRow accessibility", () => {
  it("marks the avatar decorative because the character name follows as text", () => {
    const { container } = renderRow({ characterImagePath: "avatar.png" });

    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("keeps the actions menu reachable without hover", () => {
    renderRow();

    const wrapper = screen.getByRole("button", { name: "Actions for Test Chat" }).parentElement;
    expect(wrapper?.className).toContain("group-focus-within:opacity-100");
    expect(wrapper?.className).toContain("pointer-coarse:opacity-100");
    expect(wrapper?.className).toContain("has-aria-expanded:opacity-100");
  });

  it("gives the character link a 40px target", () => {
    renderRow();

    expect(screen.getByRole("link", { name: "View Test Character" }).className).toContain(
      "size-10",
    );
  });
});
