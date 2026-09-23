// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

// vi.hoisted is required: vitest hoists vi.mock factories above top-level const
// declarations, so a factory referencing a plain const hits a TDZ at import time.
const { mockUseCharacterSearch } = vi.hoisted(() => ({
  mockUseCharacterSearch: vi.fn(),
}));

vi.mock("@/hooks/useCharacters", () => ({
  useCharacterSearch: mockUseCharacterSearch,
}));

// Render Link as a plain anchor so the test needs no router context.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children?: ReactNode; params?: { id: string } }) => (
    <a href={`/characters/${params?.id ?? ""}`}>{children}</a>
  ),
}));

import type { CharacterCardItem } from "@/db/repositories/characters";
import { MoreByCreator } from "./more-by-creator";

// No vitest setup file / globals in this repo, so RTL auto-cleanup never runs.
afterEach(cleanup);

function card(id: string, overrides: Partial<CharacterCardItem> = {}): CharacterCardItem {
  return {
    id,
    name: id,
    spec: "chara_card_v2",
    specVersion: "2.0",
    imagePath: null,
    tagline: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    tags: [],
    creatorNotes: "",
    creator: "Aria",
    chatCount: 0,
    ...overrides,
  };
}

function mockItems(items: CharacterCardItem[]) {
  mockUseCharacterSearch.mockReturnValue({ data: { pages: [{ items }] } });
}

describe("MoreByCreator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders same-creator cards and excludes the current character", () => {
    mockItems([card("alpha"), card("current", { creator: "Aria" }), card("beta")]);
    render(<MoreByCreator creator="Aria" currentId="current" />);

    expect(screen.getByText("More by Aria")).toBeTruthy();
    expect(screen.getByText("alpha")).toBeTruthy();
    expect(screen.getByText("beta")).toBeTruthy();
    expect(screen.queryByText("current")).toBeNull();
    expect(mockUseCharacterSearch).toHaveBeenCalledWith({ q: "Aria" });
  });

  it("renders a versioned responsive thumbnail for cards with portraits", () => {
    mockItems([card("alpha", { imagePath: "uploads/avatars/alpha.png" })]);
    render(<MoreByCreator creator="Aria" currentId="current" />);

    const image = screen.getByAltText("alpha");
    expect(image.getAttribute("srcset")).toContain("v=alpha.png");
    expect(image.getAttribute("srcset")).toContain("w=128&q=70");
    expect(image.getAttribute("sizes")).toBe("112px");
  });

  it("excludes an item whose name contains the creator but whose creator differs", () => {
    mockItems([card("fan", { name: "Aria Fanart", creator: "someone-else" }), card("real")]);
    render(<MoreByCreator creator="Aria" currentId="current" />);

    expect(screen.getByText("real")).toBeTruthy();
    expect(screen.queryByText("Aria Fanart")).toBeNull();
  });

  it("renders nothing when no card matches", () => {
    mockItems([card("x", { creator: "other" })]);
    const { container } = render(<MoreByCreator creator="Aria" currentId="current" />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("More by Aria")).toBeNull();
  });

  it("renders nothing when there is no search data yet", () => {
    mockUseCharacterSearch.mockReturnValue({ data: undefined });
    const { container } = render(<MoreByCreator creator="Aria" currentId="current" />);

    expect(container.firstChild).toBeNull();
  });
});
