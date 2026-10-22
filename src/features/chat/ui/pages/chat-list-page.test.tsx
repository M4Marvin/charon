// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChatListItem } from "@/server/fns/chats";
import { useChats } from "@/hooks/useChats";
import { ChatListPage } from "./chat-list-page";

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

vi.mock("@/hooks/useChats", () => ({
  useChats: vi.fn(),
  useDeleteChat: () => ({ isPending: false, mutate: vi.fn() }),
  useRenameChat: () => ({ isPending: false, mutate: vi.fn() }),
}));

const chat = (id: string, title: string): ChatListItem => ({
  id,
  characterId: `char-${id}`,
  title,
  characterName: title,
  characterImagePath: null,
  lastMessagePreview: null,
  userMessageCount: 1,
  backgroundId: null,
  characterDescription: "",
  characterPersonality: "",
  characterScenario: "",
  characterSystemPrompt: "",
  createdAt: new Date(),
  updatedAt: new Date(),
});

function mockChats(overrides: Partial<ReturnType<typeof useChats>>) {
  vi.mocked(useChats).mockReturnValue(overrides as ReturnType<typeof useChats>);
}

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ChatListPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ChatListPage", () => {
  it("keeps the primary action and announces loading", () => {
    mockChats({ data: undefined, isLoading: true, error: null });

    renderPage();

    expect(screen.getByRole("button", { name: /Choose a character/ })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Loading chats…");
  });

  it("shows the total and filters the count", () => {
    mockChats({
      data: [chat("1", "Elara"), chat("2", "Vek")],
      isLoading: false,
      error: null,
    });

    renderPage();
    expect(screen.getByRole("status").textContent).toBe("2 chats");

    fireEvent.change(screen.getByLabelText("Search chats"), { target: { value: "elara" } });

    expect(screen.getByRole("status").textContent).toBe("1 of 2 chats");
  });

  it("keeps cached rows when a refresh fails", () => {
    mockChats({
      data: [chat("1", "Elara"), chat("2", "Vek")],
      isLoading: false,
      error: new Error("refresh failed"),
    });

    renderPage();

    expect(screen.getByText("Elara")).toBeTruthy();
    expect(screen.getByText("refresh failed")).toBeTruthy();
  });

  it("shows a full error state with the header action when nothing is cached", () => {
    mockChats({ data: undefined, isLoading: false, error: new Error("load failed") });

    renderPage();

    expect(screen.getByText("load failed")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Choose a character/ })).toBeTruthy();
  });

  it("shows the empty state when there are no chats", () => {
    mockChats({ data: [], isLoading: false, error: null });

    renderPage();

    expect(screen.getByText("No chats yet")).toBeTruthy();
  });
});
