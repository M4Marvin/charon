// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AvatarImage", () => {
  it("uses the native responsive image without Radix's extra preloader", () => {
    const originalImage = window.Image;
    const preloader = vi.fn();
    vi.stubGlobal(
      "Image",
      vi.fn(function ImageStub(this: HTMLImageElement) {
        preloader();
        return new originalImage();
      }),
    );

    render(
      <Avatar>
        <AvatarImage src="/api/characters/character-1/avatar" alt="Character" />
        <AvatarFallback>C</AvatarFallback>
      </Avatar>,
    );

    const image = screen.getByAltText("Character");
    expect(preloader).not.toHaveBeenCalled();
    expect(image.getAttribute("srcset")).toContain("w=48&q=80");
    expect(image.classList.contains("opacity-0")).toBe(true);
    expect(image.classList.contains("absolute")).toBe(true);
    expect(screen.getByText("C")).toBeTruthy();

    fireEvent.load(image);
    expect(image.classList.contains("opacity-0")).toBe(false);
    expect(screen.queryByText("C")).toBeNull();
  });

  it("keeps the fallback visible when the image fails", () => {
    render(
      <Avatar>
        <AvatarImage src="/api/characters/character-1/avatar" alt="Character" />
        <AvatarFallback>C</AvatarFallback>
      </Avatar>,
    );

    fireEvent.error(screen.getByAltText("Character"));
    expect(screen.getByText("C")).toBeTruthy();
  });

  it("shows the fallback again when the image source changes", async () => {
    const { rerender } = render(
      <Avatar>
        <AvatarImage src="/api/characters/character-1/avatar?v=one" alt="Character" />
        <AvatarFallback>C</AvatarFallback>
      </Avatar>,
    );

    fireEvent.load(screen.getByAltText("Character"));
    await waitFor(() => expect(screen.queryByText("C")).toBeNull());

    rerender(
      <Avatar>
        <AvatarImage src="/api/characters/character-1/avatar?v=two" alt="Character" />
        <AvatarFallback>C</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText("C")).toBeTruthy();
  });

  it("keeps the fallback visible when no image is rendered", () => {
    render(
      <Avatar>
        <AvatarFallback>C</AvatarFallback>
      </Avatar>,
    );

    expect(screen.getByText("C")).toBeTruthy();
  });
});
