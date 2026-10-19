// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { mockRunProposal } = vi.hoisted(() => ({ mockRunProposal: vi.fn() }));
vi.mock("@/features/generation/proposal-fns", () => ({ runProposalFn: mockRunProposal }));

import { SelectionPromptDialog } from "./selection-prompt-dialog";

// No vitest setup file / globals in this repo, so RTL auto-cleanup never runs.
afterEach(cleanup);

const baseProps = {
  chatId: "c1",
  messageIds: [2, 3],
  open: true,
  onOpenChange: vi.fn(),
  onGenerated: vi.fn(),
};

function renderDialog() {
  return render(<SelectionPromptDialog {...baseProps} />);
}

describe("SelectionPromptDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a prompt before generating", () => {
    renderDialog();

    const generate = screen.getByRole("button", { name: "Generate" }) as HTMLButtonElement;
    expect(generate.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: "Summarize." } });
    expect(generate.disabled).toBe(false);
  });

  it("runs the prompt on the selection and hands the result to the composer", async () => {
    mockRunProposal.mockResolvedValue({ jobId: "j1", proposalId: "p1", text: "Result text" });
    renderDialog();

    fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: "  Summarize.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => expect(baseProps.onGenerated).toHaveBeenCalledWith("Result text"));
    expect(mockRunProposal).toHaveBeenCalledWith({
      data: {
        chatId: "c1",
        trigger: "transform",
        selection: [2, 3],
        instruction: "Summarize.",
      },
    });
    expect(baseProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Deny" })).toBeNull();
  });

  it("shows the failure inline and keeps the dialog open", async () => {
    mockRunProposal.mockRejectedValue(new Error("A generation is already running in this chat."));
    renderDialog();

    fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: "Summarize." } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() =>
      expect(screen.getByText("A generation is already running in this chat.")).toBeTruthy(),
    );
    expect(baseProps.onGenerated).not.toHaveBeenCalled();
    expect(baseProps.onOpenChange).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Generate" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
