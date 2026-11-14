// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { ImportError, PreviewResult } from "@/server/fns/characters";

// vi.hoisted is required: vitest hoists vi.mock factories above top-level const
// declarations, so a factory referencing a plain const hits a TDZ at import time.
const {
  mockFileToBase64,
  mockPreviewCharacter,
  mockToastSuccess,
  mockImportCharacter,
  mockUpdateCharacterFromCard,
  // Mutable test state read by the mock factories below.
  routerState,
  targetCharacterState,
  pendingState,
} = vi.hoisted(() => ({
  mockFileToBase64: vi.fn(),
  mockPreviewCharacter: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockImportCharacter: vi.fn(),
  mockUpdateCharacterFromCard: vi.fn(),
  routerState: { search: {} as Record<string, string> },
  targetCharacterState: {
    character: undefined as { id: string; name: string } | undefined,
    error: null as Error | null,
  },
  // Mirrors useMutation.isPending for the update mutation; tests set it and
  // rerender manually because the mock has no React state of its own.
  pendingState: { updating: false },
}));

vi.mock("sonner", () => ({ toast: { success: mockToastSuccess } }));

vi.mock("@/hooks/useCharacters", () => ({
  fileToBase64: mockFileToBase64,
  // Kills the QueryClientProvider dependency AND the server-fn import chain in one shot.
  useCharacter: () => ({
    data: targetCharacterState.character,
    isLoading: false,
    error: targetCharacterState.error,
  }),
  useImportCharacter: () => ({ isPending: false, mutateAsync: mockImportCharacter }),
  useUpdateCharacterFromCard: () => ({
    isPending: pendingState.updating,
    mutateAsync: mockUpdateCharacterFromCard,
  }),
}));

vi.mock("@/server/fns/characters", () => ({
  previewCharacter: mockPreviewCharacter,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: { component: () => ReactNode }) => ({
    component: opts.component,
    // NewCharacterPage reads Route.useSearch() for the ?update=<id> mode.
    useSearch: () => routerState.search,
  }),
  useNavigate: () => vi.fn(),
  // Required: PageHeader renders <Link to={backTo}> (PageHeader.tsx:17).
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
}));

import { NewCharacterPage } from "./new";

const nativeCreateObjectURL = URL.createObjectURL;
const nativeRevokeObjectURL = URL.revokeObjectURL;

// No vitest setup file / globals in this repo, so RTL auto-cleanup never runs.
afterEach(() => {
  cleanup();
  URL.createObjectURL = nativeCreateObjectURL;
  URL.revokeObjectURL = nativeRevokeObjectURL;
});

type PreviewResponse = { ok: true; data: PreviewResult } | { ok: false; error: ImportError };

const minimalOkPreview: PreviewResult = {
  preview: {
    name: "Ada Lovelace",
    creator: "Test Creator",
    descriptionExcerpt: "A test character card.",
    tags: ["test"],
    spec: "chara_card_v2",
    specVersion: "2.0",
    greetingCount: 0,
    lorebookEntryCount: 0,
    warnings: [],
  },
  duplicates: [],
};

function makePngFile(): File {
  return new File([new Uint8Array(8)], "test.png", { type: "image/png" });
}

describe("NewCharacterPage import loading state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.search = {};
    targetCharacterState.character = undefined;
    targetCharacterState.error = null;
    // jsdom does not implement object URLs; the settled preview owns one and revokes it on cleanup.
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
  });

  it("shows a spinner and disables the upload card while processing a file", async () => {
    // Never-settling promise keeps the component stuck in the processing state.
    mockPreviewCharacter.mockReturnValue(new Promise<PreviewResponse>(() => {}));

    const { container } = render(<NewCharacterPage />);
    fireEvent.change(screen.getByLabelText("Choose a character card PNG"), {
      target: { files: [makePngFile()] },
    });
    // Flush the fileToBase64 microtask so previewCharacter is actually invoked and the
    // processing state has been committed.
    await act(async () => {});

    const card = screen.getByRole("button", { name: /processing/i }) as HTMLButtonElement;
    expect(card.disabled).toBe(true);
    expect(container.querySelector('[data-slot="spinner"]')).not.toBeNull();
  });

  it("renders the preview step once processing settles", async () => {
    let resolvePreview!: (v: PreviewResponse) => void;
    mockPreviewCharacter.mockReturnValue(
      new Promise<PreviewResponse>((resolve) => {
        resolvePreview = resolve;
      }),
    );

    const view = render(<NewCharacterPage />);
    fireEvent.change(screen.getByLabelText("Choose a character card PNG"), {
      target: { files: [makePngFile()] },
    });
    await act(async () => {});
    await act(async () => {
      resolvePreview({ ok: true, data: minimalOkPreview });
    });
    await act(async () => {});

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /choose a character card png/i })).toBeNull();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("keeps the upload card enabled when validation fails (regression)", () => {
    render(<NewCharacterPage />);
    fireEvent.change(screen.getByLabelText("Choose a character card PNG"), {
      target: { files: [new File(["x"], "t.txt", { type: "text/plain" })] },
    });

    expect(screen.getByText("That file isn't a PNG. Choose a character card PNG.")).toBeTruthy();
    const card = screen.getByRole("button", {
      name: /choose a character card png/i,
    }) as HTMLButtonElement;
    expect(card.disabled).toBe(false);
  });

  it("shows the lorebook name in the success toast", async () => {
    let resolvePreview!: (v: PreviewResponse) => void;
    mockPreviewCharacter.mockReturnValue(
      new Promise<PreviewResponse>((resolve) => {
        resolvePreview = resolve;
      }),
    );
    // handleImport guards on `previewB64` being truthy (new.tsx:87), so the
    // file mock must resolve to something for the import path to run.
    mockFileToBase64.mockResolvedValue("fake-png-base64");
    mockImportCharacter.mockResolvedValue({
      ok: true,
      character: { id: "c1", name: "Emme Freehold Your Pet Mom", imagePath: null },
      lorebook: { id: "lb1", name: "Yume", entriesInserted: 8, entriesSkipped: 0 },
    });

    render(<NewCharacterPage />);
    fireEvent.change(screen.getByLabelText("Choose a character card PNG"), {
      target: { files: [makePngFile()] },
    });
    await act(async () => {});
    await act(async () => {
      resolvePreview({ ok: true, data: minimalOkPreview });
    });
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await act(async () => {});

    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining("Yume"));
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining("8"));
  });
});

describe("NewCharacterPage duplicate choice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.search = {};
    targetCharacterState.character = undefined;
    targetCharacterState.error = null;
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
  });

  async function renderWithDuplicates() {
    mockFileToBase64.mockResolvedValue("fake-png-base64");
    let resolvePreview!: (v: PreviewResponse) => void;
    mockPreviewCharacter.mockReturnValue(
      new Promise<PreviewResponse>((resolve) => {
        resolvePreview = resolve;
      }),
    );
    render(<NewCharacterPage />);
    fireEvent.change(screen.getByLabelText("Choose a character card PNG"), {
      target: { files: [makePngFile()] },
    });
    await act(async () => {});
    await act(async () => {
      resolvePreview({
        ok: true,
        data: {
          ...minimalOkPreview,
          duplicates: [
            { id: "char-2", name: "Ada Lovelace", updatedAt: new Date().toISOString() },
            { id: "char-1", name: "Ada Lovelace", updatedAt: new Date().toISOString() },
          ],
        },
      });
    });
    await act(async () => {});
  }

  it("offers update and import-as-new with a target picker", async () => {
    await renderWithDuplicates();

    expect(screen.getByRole("radiogroup", { name: /existing character/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /import as new/i })).toBeTruthy();
    // Default target is the first (most recently updated) duplicate.
    expect(screen.getByRole("button", { name: /update “ada lovelace”/i })).toBeTruthy();
  });

  it("updates the selected duplicate instead of importing", async () => {
    await renderWithDuplicates();
    mockUpdateCharacterFromCard.mockResolvedValue({
      ok: true,
      character: { id: "char-2", name: "Ada Lovelace", imagePath: null },
    });

    fireEvent.click(screen.getByRole("button", { name: /update “ada lovelace”/i }));
    await act(async () => {});

    expect(mockUpdateCharacterFromCard).toHaveBeenCalledWith({
      pngBase64: "fake-png-base64",
      targetId: "char-2",
    });
    expect(mockImportCharacter).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining("Updated"));
  });

  it("imports as a new character when the user picks that action", async () => {
    await renderWithDuplicates();
    mockImportCharacter.mockResolvedValue({
      ok: true,
      character: { id: "c1", name: "Ada Lovelace", imagePath: null },
    });

    fireEvent.click(screen.getByRole("button", { name: /import as new/i }));
    await act(async () => {});

    expect(mockImportCharacter).toHaveBeenCalledWith({ pngBase64: "fake-png-base64" });
    expect(mockUpdateCharacterFromCard).not.toHaveBeenCalled();
  });
});

describe("NewCharacterPage update mode (?update=<id>)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.search = {};
    targetCharacterState.character = undefined;
    targetCharacterState.error = null;
    pendingState.updating = false;
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
  });

  function enterUpdateMode(target?: { id: string; name: string }, error: Error | null = null) {
    routerState.search = { update: "char-9" };
    targetCharacterState.character = target;
    targetCharacterState.error = error;
  }

  async function renderThroughPreview(previewOverrides?: Partial<PreviewResult["preview"]>) {
    mockFileToBase64.mockResolvedValue("fake-png-base64");
    mockPreviewCharacter.mockResolvedValue({
      ok: true,
      data: {
        ...minimalOkPreview,
        preview: { ...minimalOkPreview.preview, ...previewOverrides },
      },
    });
    const view = render(<NewCharacterPage />);
    fireEvent.change(screen.getByLabelText("Choose a character card PNG"), {
      target: { files: [makePngFile()] },
    });
    await act(async () => {});
    await act(async () => {});
    return view;
  }

  it("hides the duplicate picker and import-as-new; shows the target name", async () => {
    enterUpdateMode({ id: "char-9", name: "Old Name" });
    await renderThroughPreview();

    expect(screen.getByRole("heading", { name: "Update character" })).toBeTruthy();
    expect(screen.getByText(/updating “old name”/i)).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("button", { name: /import as new/i })).toBeNull();
    expect(screen.getByRole("button", { name: /update character/i })).toBeTruthy();
  });

  it("warns when the incoming card renames the target", async () => {
    enterUpdateMode({ id: "char-9", name: "Old Name" });
    await renderThroughPreview({ name: "New Name" });

    expect(screen.getByText(/will rename “old name” to “new name”/i)).toBeTruthy();
  });

  it("blocks the flow upfront when the update target no longer exists", async () => {
    enterUpdateMode(undefined, new Error("Character not found"));
    render(<NewCharacterPage />);

    expect(screen.getByText(/no longer exists/i)).toBeTruthy();
    expect(screen.queryByLabelText("Choose a character card PNG")).toBeNull();
  });

  it("locks the update action after a target_missing failure", async () => {
    enterUpdateMode({ id: "char-9", name: "Old Name" });
    await renderThroughPreview();
    mockUpdateCharacterFromCard.mockResolvedValue({
      ok: false,
      error: { kind: "target_missing", message: "The character to update no longer exists." },
    });

    fireEvent.click(screen.getByRole("button", { name: /update character/i }));
    await act(async () => {});

    expect(screen.getByText(/no longer exists/i)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /update character/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("locks file picking and exit buttons while the update is in flight", async () => {
    enterUpdateMode({ id: "char-9", name: "Old Name" });
    const { rerender } = await renderThroughPreview();
    // Emulate an in-flight mutation: the mock hook reads pendingState, which
    // needs a manual rerender since it holds no React state.
    pendingState.updating = true;
    mockUpdateCharacterFromCard.mockReturnValue(new Promise<PreviewResponse>(() => {}));
    rerender(<NewCharacterPage />);

    fireEvent.click(screen.getByRole("button", { name: /updating/i }));
    await act(async () => {});

    expect((screen.getByRole("button", { name: /cancel/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole("button", { name: /choose different file/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
