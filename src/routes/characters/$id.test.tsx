// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

// vi.hoisted is required: vitest hoists vi.mock factories above top-level const
// declarations, so a factory referencing a plain const hits a TDZ at import time.
const { mockUseCharacter, mockUseDeleteCharacter, mockToastSuccess } = vi.hoisted(() => ({
  mockUseCharacter: vi.fn(),
  mockUseDeleteCharacter: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: mockToastSuccess } }));

vi.mock("@/hooks/useCharacters", () => ({
  useCharacter: mockUseCharacter,
  useDeleteCharacter: mockUseDeleteCharacter,
  useUpdateCharacter: () => ({ mutate: vi.fn() }),
  useCharacterSearch: () => ({
    data: { pages: [{ items: [] }], pageParams: [0] },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useChats", () => ({
  useCreateChat: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useChatsByCharacter: () => ({ data: [] }),
}));

vi.mock("@tanstack/react-router", () => ({
  // Route.useParams() is called inside CharacterDetailPage ($id.tsx:48).
  createFileRoute: () => (opts: { component: () => ReactNode }) => ({
    component: opts.component,
    useParams: () => ({ id: "char-1" }),
  }),
  useNavigate: () => vi.fn(),
  // Forward `to`/`search` onto data-* so tests can assert nav targets (the real
  // Link consumes them; a bare <a> drops them). Router-only props are stripped
  // so they don't leak onto the DOM node as invalid attributes.
  Link: ({
    children,
    to,
    search,
  }: {
    children?: ReactNode;
    to?: string;
    search?: Record<string, unknown>;
  }) => (
    <a data-to={to} data-search={search ? JSON.stringify(search) : undefined}>
      {children}
    </a>
  ),
}));

// The page renders these for the fixture's non-empty description/personality/
// scenario/first_mes — stub them out to keep the test fast and jsdom-safe.
vi.mock("@/components/character/EmbeddedLorebookPanel", () => ({
  EmbeddedLorebookPanel: () => null,
}));
vi.mock("@/components/MarkdownContent", () => ({ MarkdownContent: () => null }));

import type { CharacterDetail } from "@/db/repositories/characters";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { CharacterDetailPage } from "./$id";

// No vitest setup file / globals in this repo, so RTL auto-cleanup never runs.
afterEach(cleanup);

const zephyr: CharacterDetail = {
  id: "char-1",
  name: "Zephyr",
  data: makeCharacterData({ name: "Zephyr" }),
  spec: "chara_card_v2",
  specVersion: "2.0",
  imagePath: null,
  tagline: null,
  creator: "tester",
  creatorNotes: "",
  tags: ["test"],
  createdAt: new Date(),
  updatedAt: new Date(),
  chatCount: 2,
  userMessageCount: 2,
  messageCount: 5,
};

describe("CharacterDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCharacter.mockReturnValue({ data: zephyr, isLoading: false, error: null });
    mockUseDeleteCharacter.mockReturnValue({ isPending: false, mutate: vi.fn() });
    // ClampedText measures with a ResizeObserver; embla reads matchMedia.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        media: "",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows chats and messages counts in the delete confirmation", async () => {
    render(<CharacterDetailPage />);
    // Radix DropdownMenuTrigger opens on pointerdown, not click.
    fireEvent.pointerDown(screen.getByLabelText("Character actions"));
    await act(async () => {});
    fireEvent.click(screen.getByText("Delete"));
    await act(async () => {});

    expect(screen.getByText(/2 chats/)).toBeTruthy();
    expect(screen.getByText(/5 messages/)).toBeTruthy();
  });

  it("renders the redesigned layout: name heading, chat CTA, and tag link", () => {
    render(<CharacterDetailPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Zephyr" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start chat" })).toBeTruthy();

    const tagLink = screen.getByText("test").closest("a");
    expect(tagLink).toBeTruthy();
    expect(tagLink?.getAttribute("data-to")).toBe("/characters");
    expect(tagLink?.getAttribute("data-search")).toBe(JSON.stringify({ tags: "test" }));
  });

  it("renders the visible Creator Notes section when creator notes are present", () => {
    mockUseCharacter.mockReturnValue({
      data: {
        ...zephyr,
        data: makeCharacterData({ name: "Zephyr", creator_notes: "Some creator notes." }),
      },
      isLoading: false,
      error: null,
    });
    render(<CharacterDetailPage />);

    expect(screen.getByRole("heading", { name: "Creator Notes" })).toBeDefined();
  });

  it("omits the Creator Notes section when creator notes are empty", () => {
    mockUseCharacter.mockReturnValue({
      data: {
        ...zephyr,
        data: makeCharacterData({ name: "Zephyr", creator_notes: "" }),
      },
      isLoading: false,
      error: null,
    });
    render(<CharacterDetailPage />);

    expect(screen.queryByRole("heading", { name: "Creator Notes" })).toBeNull();
  });
});
