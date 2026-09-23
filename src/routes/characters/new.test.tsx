// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { ImportError, PreviewResult } from "@/server/fns/characters";

// vi.hoisted is required: vitest hoists vi.mock factories above top-level const
// declarations, so a factory referencing a plain const hits a TDZ at import time.
const { mockFileToBase64, mockPreviewCharacter, mockToastSuccess, mockImportCharacter } =
  vi.hoisted(() => ({
    mockFileToBase64: vi.fn(),
    mockPreviewCharacter: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockImportCharacter: vi.fn(),
  }));

vi.mock("sonner", () => ({ toast: { success: mockToastSuccess } }));

vi.mock("@/hooks/useCharacters", () => ({
  fileToBase64: mockFileToBase64,
  // Kills the QueryClientProvider dependency AND the server-fn import chain in one shot.
  useImportCharacter: () => ({ isPending: false, mutateAsync: mockImportCharacter }),
}));

vi.mock("@/server/fns/characters", () => ({
  previewCharacter: mockPreviewCharacter,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: { component: () => ReactNode }) => ({ component: opts.component }),
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
  duplicateOf: null,
};

function makePngFile(): File {
  return new File([new Uint8Array(8)], "test.png", { type: "image/png" });
}

describe("NewCharacterPage import loading state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom does not implement object URLs; the settled preview owns one and revokes it on cleanup.
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
  });

  it("shows a spinner and disables the upload card while processing a file", async () => {
    // Never-settling promise keeps the component stuck in the processing state.
    mockPreviewCharacter.mockReturnValue(new Promise<PreviewResponse>(() => {}));

    const { container } = render(<NewCharacterPage />);
    fireEvent.change(screen.getByLabelText("Choose a PNG character card"), {
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
    fireEvent.change(screen.getByLabelText("Choose a PNG character card"), {
      target: { files: [makePngFile()] },
    });
    await act(async () => {});
    await act(async () => {
      resolvePreview({ ok: true, data: minimalOkPreview });
    });
    await act(async () => {});

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /choose a png character card/i })).toBeNull();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("keeps the upload card enabled when validation fails (regression)", () => {
    render(<NewCharacterPage />);
    fireEvent.change(screen.getByLabelText("Choose a PNG character card"), {
      target: { files: [new File(["x"], "t.txt", { type: "text/plain" })] },
    });

    expect(screen.getByText("Only PNG files are supported.")).toBeTruthy();
    const card = screen.getByRole("button", {
      name: /choose a png character card/i,
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
    fireEvent.change(screen.getByLabelText("Choose a PNG character card"), {
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
