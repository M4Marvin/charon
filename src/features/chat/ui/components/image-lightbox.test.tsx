// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ImageLightbox } from "./image-lightbox";

afterEach(cleanup);

describe("ImageLightbox", () => {
  it("shows a fallback when the image cannot be loaded", () => {
    render(
      <ImageLightbox
        src="/api/characters/character-1/avatar?v=portrait.png"
        alt="Portrait"
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.error(screen.getByAltText("Portrait"));
    expect(screen.getByText("Image unavailable")).toBeTruthy();
  });

  it("resets zoom when the lightbox closes and reopens", () => {
    const { rerender } = render(
      <ImageLightbox
        src="/api/characters/character-1/avatar?v=portrait.png"
        alt="Portrait"
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("button", { name: "Fit to screen" })).toBeTruthy();

    rerender(
      <ImageLightbox
        src="/api/characters/character-1/avatar?v=portrait.png"
        alt="Portrait"
        open={false}
        onOpenChange={vi.fn()}
      />,
    );
    rerender(
      <ImageLightbox
        src="/api/characters/character-1/avatar?v=portrait.png"
        alt="Portrait"
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Zoom in" })).toBeTruthy();
  });
});
