// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ChatListItem } from "@/server/fns/chats";
import { useChats } from "@/hooks/useChats";
import { useChatList, dayGroup } from "./use-chat-list";

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
  vi.useRealTimers();
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

describe("dayGroup", () => {
  const now = new Date(2026, 9, 19, 12, 0, 0);

  it("uses calendar-day boundaries", () => {
    expect(dayGroup(new Date(2026, 9, 19, 0, 0, 0), now)).toBe("Today");
    expect(dayGroup(new Date(2026, 9, 18, 23, 59, 59), now)).toBe("Yesterday");
    expect(dayGroup(new Date(2026, 9, 12, 0, 0, 0), now)).toBe("Previous 7 days");
    expect(dayGroup(new Date(2026, 9, 11, 23, 59, 59), now)).toBe("Older");
  });

  it("re-groups when the clock crosses midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 19, 23, 59, 30));
    vi.mocked(useChats).mockReturnValue({
      data: [chat({ id: "chat-1", updatedAt: new Date(2026, 9, 19, 23, 59, 0) })],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useChats>);

    const { result } = renderHook(() => useChatList());
    expect(result.current.grouped.get("Today")).toHaveLength(1);

    act(() => vi.advanceTimersByTime(60_000));

    expect(result.current.grouped.get("Today")).toBeUndefined();
    expect(result.current.grouped.get("Yesterday")).toHaveLength(1);
  });
});
