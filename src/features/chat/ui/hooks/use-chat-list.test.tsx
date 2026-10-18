// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ChatListItem } from "@/server/fns/chats";
import { useChats } from "@/hooks/useChats";
import { useChatList } from "./use-chat-list";

vi.mock("@/hooks/useChats", () => ({ useChats: vi.fn() }));

const chat = (overrides: Partial<ChatListItem>) =>
  ({
    id: "chat-1",
    characterId: "char-1",
    title: "Elara",
    characterName: "Elara",
    characterImagePath: null,
    lastMessagePreview: null,
    userMessageCount: 2,
    backgroundId: null,
    characterDescription: "",
    characterPersonality: "",
    characterScenario: "",
    characterSystemPrompt: "",
    createdAt: new Date("2026-10-18T10:00:00Z"),
    updatedAt: new Date("2026-10-18T10:00:00Z"),
    ...overrides,
  }) satisfies ChatListItem;

afterEach(() => {
  vi.clearAllMocks();
});

describe("useChatList", () => {
  it("ignores surrounding whitespace when filtering", () => {
    vi.mocked(useChats).mockReturnValue({
      data: [
        chat({ id: "chat-1", title: "Elara" }),
        chat({ id: "chat-2", title: "Vek", characterName: "Vek" }),
      ],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useChats>);

    const { result } = renderHook(() => useChatList());
    act(() => result.current.setSearch("  elara "));

    expect(result.current.filtered.map((c) => c.id)).toEqual(["chat-1"]);
  });

  it("matches the character name as well as the title", () => {
    vi.mocked(useChats).mockReturnValue({
      data: [chat({ id: "chat-1", title: "The Tavern", characterName: "Elara" })],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useChats>);

    const { result } = renderHook(() => useChatList());
    act(() => result.current.setSearch("elara"));

    expect(result.current.filtered.map((c) => c.id)).toEqual(["chat-1"]);
  });
});
