// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { RevisionSummary } from "@/db/repositories/character-revisions";

const {
  mockRestore,
  mockToastSuccess,
  mockToastError,
  routerState,
  characterState,
  revisionsState,
  pendingState,
} = vi.hoisted(() => ({
  mockRestore: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  routerState: { params: { id: "char-1" } },
  characterState: {
    character: undefined as { id: string; name: string } | undefined,
    error: null as Error | null,
  },
  revisionsState: { list: [] as RevisionSummary[] },
  // Mirrors useMutation.isPending for the shared restore mutation; tests set
  // it and rerender manually because the mock holds no React state.
  pendingState: { restoring: false },
}));

vi.mock("sonner", () => ({ toast: { success: mockToastSuccess, error: mockToastError } }));

vi.mock("@/hooks/useCharacters", () => ({
  useCharacter: () => ({
    data: characterState.character,
    error: characterState.error,
    isLoading: false,
  }),
  useCharacterRevisions: () => ({
    data: revisionsState.list,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCharacterRevision: () => ({ data: undefined, isLoading: false, error: null }),
  useRestoreCharacterRevision: () => ({
    isPending: pendingState.restoring,
    mutate: mockRestore,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: { component: () => ReactNode }) => ({
    component: opts.component,
    // The page reads Route.useParams() for the character id.
    useParams: () => routerState.params,
  }),
  useParams: () => routerState.params,
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
}));

import { CharacterRevisionsPage } from "@/routes/characters/$id_.revisions";

const revision = (over: Partial<RevisionSummary> = {}): RevisionSummary => ({
  id: over.rev ? `rev-${over.rev}` : "rev-1",
  characterId: "char-1",
  rev: 1,
  name: "Ada",
  tagline: null,
  createdAt: new Date("2026-01-01"),
  ...over,
});

// No vitest setup file / globals in this repo, so RTL auto-cleanup never runs.
afterEach(() => {
  cleanup();
});

describe("CharacterRevisionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.params = { id: "char-1" };
    characterState.character = { id: "char-1", name: "Ada" };
    characterState.error = null;
    revisionsState.list = [revision({ rev: 2, name: "Ada" }), revision({ rev: 1, name: "Ada" })];
    pendingState.restoring = false;
  });

  it("marks the newest revision as Current and disables its Restore", () => {
    render(<CharacterRevisionsPage />);

    expect(screen.getByText("Current")).toBeTruthy();
    const restoreButtons = screen.getAllByRole("button", { name: "Restore" });
    expect(restoreButtons).toHaveLength(2);
    expect((restoreButtons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((restoreButtons[1] as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows the not-found state instead of restorable rows when the character is gone", () => {
    characterState.character = undefined;
    characterState.error = new Error("Character not found");

    render(<CharacterRevisionsPage />);

    expect(screen.getByText("Character not found")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();
  });

  it("keeps the page working on other character-load errors; never claims the character is gone", () => {
    characterState.character = undefined;
    characterState.error = new Error("boom");

    render(<CharacterRevisionsPage />);

    // The revision list does not depend on the character query, so a
    // transient load error must not blank the page — only a genuine
    // not-found replaces it.
    expect(screen.queryByText("Character not found")).toBeNull();
    expect(screen.getByText(/Version history/)).toBeTruthy();
  });

  it("routes restore failures through friendly copy instead of the raw repo message", async () => {
    mockRestore.mockImplementation((_vars, opts) => opts.onError(new Error("Character not found")));

    render(<CharacterRevisionsPage />);
    // Open the row's confirm dialog, then confirm — the mutation fires from
    // the dialog, not the row button.
    fireEvent.click(screen.getAllByRole("button", { name: "Restore" })[1]);
    const dialogButtons = screen.getAllByRole("button", { name: "Restore" });
    fireEvent.click(dialogButtons[dialogButtons.length - 1]);
    await act(async () => {});

    expect(mockRestore).toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith("Restoring version 1 failed. Try again.");
    expect(mockToastError.mock.calls[0][0]).not.toMatch(/Character not found/);
  });

  it("disables Restore on every row while a restore is in flight", () => {
    pendingState.restoring = true;

    render(<CharacterRevisionsPage />);

    const restoreButtons = screen.getAllByRole("button", { name: "Restore" });
    expect((restoreButtons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((restoreButtons[1] as HTMLButtonElement).disabled).toBe(true);
  });
});
