// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OptimizedImage } from "./optimized-image";

afterEach(cleanup);

describe("OptimizedImage", () => {
  it("generates a bounded responsive avatar srcset", () => {
    render(
      <OptimizedImage
        src="/api/characters/character-1/avatar?v=portrait.png"
        alt="Character portrait"
        preset="avatar"
        quality={70}
        priority
      />,
    );

    const image = screen.getByAltText("Character portrait");
    expect(image.getAttribute("src")).toBe(
      "/api/characters/character-1/avatar?v=portrait.png&w=48&q=70",
    );
    expect(image.getAttribute("sizes")).toBe("48px");
    expect(image.getAttribute("width")).toBe("48");
    expect(image.getAttribute("height")).toBe("48");
    expect(image.getAttribute("loading")).toBe("eager");
    expect(image.getAttribute("fetchpriority")).toBe("high");

    const srcSet = image.getAttribute("srcset");
    expect(srcSet).not.toBeNull();
    const entries = srcSet?.split(",\n") ?? [];
    expect(entries).toHaveLength(4);
    expect(entries[0]).toContain("w=48&q=70");
    expect(entries[0]).toContain("v=portrait.png");
    expect(entries[0].endsWith(" 48w")).toBe(true);
    expect(entries[3].endsWith(" 128w")).toBe(true);
  });

  it("passes through data URLs without duplicate srcset candidates", () => {
    render(<OptimizedImage src="data:image/png;base64,abc" alt="" preset="card" />);

    const image = document.querySelector("img");
    expect(image?.getAttribute("src")).toBe("data:image/png;base64,abc");
    expect(image?.hasAttribute("srcset")).toBe(false);
    expect(image?.getAttribute("role")).toBe("presentation");
    expect(image?.getAttribute("loading")).toBe("lazy");
    expect(image?.getAttribute("decoding")).toBe("async");
  });

  it("can explicitly bypass optimization for an API image", () => {
    render(
      <OptimizedImage
        src="/api/backgrounds/background-1/image"
        alt="Scene"
        preset="background"
        unoptimized
      />,
    );

    const image = screen.getByAltText("Scene");
    expect(image.getAttribute("src")).toBe("/api/backgrounds/background-1/image");
    expect(image.hasAttribute("srcset")).toBe(false);
  });
});
