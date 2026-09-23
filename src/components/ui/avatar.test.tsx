// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

    fireEvent.load(image);
    expect(image.classList.contains("opacity-0")).toBe(false);
  });
});
