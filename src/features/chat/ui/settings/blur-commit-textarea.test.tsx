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

  it("keeps the draft when the server value rolls back underneath it", () => {
    const { rerender } = render(
      <BlurCommitTextarea
        id="description"
        label="Description"
        defaultValue="old"
        onCommit={vi.fn()}
      />,
    );

    const textarea = screen.getByLabelText("Description") as HTMLTextAreaElement;
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: "new" } });

    rerender(
      <BlurCommitTextarea
        id="description"
        label="Description"
        defaultValue="old"
        onCommit={vi.fn()}
      />,
    );

    expect(textarea.value).toBe("new");
  });

  it("shows inherited state and offers to use the card value", () => {
    const onUseCard = vi.fn();
    render(
      <BlurCommitTextarea
        id="description"
        label="Description"
        defaultValue="override"
        inheritedValue="card text"
        onUseCard={onUseCard}
        onCommit={vi.fn()}
      />,
    );

    expect(screen.getByText("Custom")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Original" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use card" }));
    expect(onUseCard).toHaveBeenCalledTimes(1);
  });

  it("labels an empty override as using the card", () => {
    render(
      <BlurCommitTextarea
        id="description"
        label="Description"
        defaultValue=""
        inheritedValue="card text"
        onCommit={vi.fn()}
      />,
    );

    expect(screen.getByText("Using card")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Use card" })).toBeNull();
  });
});
