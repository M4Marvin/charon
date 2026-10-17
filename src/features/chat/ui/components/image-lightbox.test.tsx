// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ImageLightbox } from "./image-lightbox";

afterEach(cleanup);

const src = "/api/characters/character-1/avatar?v=portrait.png";

describe("ImageLightbox", () => {
  it("shows a fallback when the image cannot be loaded", () => {
    render(<ImageLightbox src={src} alt="Portrait" open onOpenChange={vi.fn()} />);

    fireEvent.error(screen.getByAltText("Portrait"));
    expect(screen.getByText("Image unavailable")).toBeTruthy();
  });

  it("retries a failed image when the lightbox is reopened", () => {
    const { rerender } = render(
      <ImageLightbox src={src} alt="Portrait" open onOpenChange={vi.fn()} />,
    );

    fireEvent.error(screen.getByAltText("Portrait"));
    expect(screen.getByText("Image unavailable")).toBeTruthy();

    rerender(<ImageLightbox src={src} alt="Portrait" open={false} onOpenChange={vi.fn()} />);
    rerender(<ImageLightbox src={src} alt="Portrait" open onOpenChange={vi.fn()} />);

    expect(screen.getByAltText("Portrait")).toBeTruthy();
  });

  it("resets zoom when the lightbox closes and reopens", () => {
    const { rerender } = render(
      <ImageLightbox src={src} alt="Portrait" open onOpenChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("button", { name: "Fit to screen" })).toBeTruthy();

    rerender(<ImageLightbox src={src} alt="Portrait" open={false} onOpenChange={vi.fn()} />);
    rerender(<ImageLightbox src={src} alt="Portrait" open onOpenChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Zoom in" })).toBeTruthy();
  });

  it("exposes the zoom state with aria-pressed", () => {
    render(<ImageLightbox src={src} alt="Portrait" open onOpenChange={vi.fn()} />);

    const zoom = screen.getByRole("button", { name: "Zoom in" });
    expect(zoom.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(zoom);

    expect(screen.getByRole("button", { name: "Fit to screen" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("does not close when the image is clicked", () => {
    const onOpenChange = vi.fn();
    render(<ImageLightbox src={src} alt="Portrait" open onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByAltText("Portrait"));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes from the real close button", () => {
    const onOpenChange = vi.fn();
    render(<ImageLightbox src={src} alt="Portrait" open onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByLabelText("Close lightbox"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
