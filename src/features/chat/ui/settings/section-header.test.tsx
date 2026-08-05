// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SectionHeader } from "./section-header";

// No vitest setup file / globals in this repo, so RTL auto-cleanup never runs.
afterEach(cleanup);

describe("SectionHeader", () => {
  it("renders the title", () => {
    render(<SectionHeader title="Display" />);

    expect(screen.getByText("Display")).toBeTruthy();
  });

  it("renders the description when passed", () => {
    render(<SectionHeader title="Display" description="Rendering options" />);

    expect(screen.getByText("Rendering options")).toBeTruthy();
  });

  it("omits the description when not passed", () => {
    const { container } = render(<SectionHeader title="Display" />);

    expect(container.textContent).not.toContain("Rendering options");
  });

  it("renders the actions node when passed", () => {
    render(
      <SectionHeader
        title="Display"
        actions={<button type="button">Import</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Import" })).toBeTruthy();
  });

  it("omits the actions node when not passed", () => {
    render(<SectionHeader title="Display" />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
