// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { ImportError, PreviewResult } from "@/server/fns/characters";

// vi.hoisted is required: vitest hoists vi.mock factories above top-level const
// declarations, so a factory referencing a plain const hits a TDZ at import time.
const { mockFileToBase64, mockPreviewCharacter } = vi.hoisted(() => ({
  mockFileToBase64: vi.fn(),
  mockPreviewCharacter: vi.fn(),
}));

vi.mock("@/hooks/useCharacters", () => ({
  fileToBase64: mockFileToBase64,
  // Kills the QueryClientProvider dependency AND the server-fn import chain in one shot.
  useImportCharacter: () => ({ isPending: false, mutateAsync: vi.fn() }),
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

vi.mock("@/lib/auth-client", () => ({
  // Admin role so the demo-redirect effect (new.tsx:23-25) never fires.
  authClient: { useSession: () => ({ data: { user: { role: "admin" } } }) },
}));

import { NewCharacterPage } from "./new";

// No vitest setup file / globals in this repo, so RTL auto-cleanup never runs.
afterEach(cleanup);

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
    // jsdom lacks createObjectURL; the preview step renders <img src={URL.createObjectURL(file)}>
    // (new.tsx:151) — without this stub the settled test crashes.
    URL.createObjectURL = vi.fn(() => "blob:mock");
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

    render(<NewCharacterPage />);
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
});
