// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BlurCommitTextarea } from "./blur-commit-textarea";

afterEach(cleanup);

describe("BlurCommitTextarea", () => {
  it("commits a changed value on blur", () => {
    const onCommit = vi.fn();
    render(
      <BlurCommitTextarea
        id="description"
        label="Description"
        defaultValue="old"
        onCommit={onCommit}
      />,
    );

    const textarea = screen.getByLabelText("Description");
    fireEvent.change(textarea, { target: { value: "new" } });
    fireEvent.blur(textarea);

    expect(onCommit).toHaveBeenCalledWith("new");
  });

  it("does not commit an unchanged value", () => {
    const onCommit = vi.fn();
    render(
      <BlurCommitTextarea
        id="description"
        label="Description"
        defaultValue="old"
        onCommit={onCommit}
      />,
    );

    fireEvent.blur(screen.getByLabelText("Description"));

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits on Cmd/Ctrl+Enter", () => {
    const onCommit = vi.fn();
    render(
      <BlurCommitTextarea
        id="description"
        label="Description"
        defaultValue="old"
        onCommit={onCommit}
      />,
    );

    const textarea = screen.getByLabelText("Description");
    fireEvent.change(textarea, { target: { value: "new" } });
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    expect(onCommit).toHaveBeenCalledWith("new");
  });

  it("shows save state and retry", () => {
    const onRetry = vi.fn();
    render(
      <BlurCommitTextarea
        id="description"
        label="Description"
        defaultValue="old"
        onCommit={vi.fn()}
        status="error"
        error={new Error("network")}
        onRetry={onRetry}
      />,
    );

    const textarea = screen.getByLabelText("Description");
    fireEvent.change(textarea, { target: { value: "draft" } });

    expect(screen.getByText(/Couldn't save/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("offers reset to the character card when an override exists", () => {
    const onReset = vi.fn();
    render(
      <BlurCommitTextarea
        id="description"
        label="Description"
        defaultValue="override"
        onCommit={vi.fn()}
        onReset={onReset}
        resetLabel="Reset to card"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset to card" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("keeps the draft when a save fails", () => {
    const { rerender } = render(
      <BlurCommitTextarea
        id="description"
        label="Description"
        defaultValue="old"
        onCommit={vi.fn()}
      />,
    );

    const textarea = screen.getByLabelText("Description") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "new" } });

    rerender(
      <BlurCommitTextarea
        id="description"
        label="Description"
        defaultValue="new"
        onCommit={vi.fn()}
        status="saving"
      />,
    );
    rerender(
      <BlurCommitTextarea
        id="description"
        label="Description"
        defaultValue="old"
        onCommit={vi.fn()}
        status="error"
        error={new Error("network")}
      />,
    );

    expect(textarea.value).toBe("new");
  });

  it("offers a local revert for unsaved text", () => {
    render(
      <BlurCommitTextarea
        id="description"
        label="Description"
        defaultValue="old"
        onCommit={vi.fn()}
      />,
    );

    const textarea = screen.getByLabelText("Description") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Revert" }));

    expect(textarea.value).toBe("old");
  });
});
