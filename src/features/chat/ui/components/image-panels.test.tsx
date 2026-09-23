// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CharacterPortraitPanel } from "./character-portrait-panel";
import { CustomImagePanel } from "./custom-image-panel";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const portraitSrc = "/api/characters/character-1/avatar?v=portrait.png";
const backgroundSrc = "/api/backgrounds/background-1/image?v=background.png";

function renderPortrait(open: boolean) {
  return render(
    <CharacterPortraitPanel
      open={open}
      name="Zephyr"
      imageSrc={portraitSrc}
      isStreaming={false}
      onClose={vi.fn()}
      onImageClick={vi.fn()}
    />,
  );
}

function renderBackground(open: boolean) {
  return render(
    <CustomImagePanel
      open={open}
      imageSrc={backgroundSrc}
      customImageSrc={null}
      onClose={vi.fn()}
      onImageClick={vi.fn()}
      onUploadImage={vi.fn()}
      onClearImage={vi.fn()}
    />,
  );
}

describe("off-canvas image panels", () => {
  it("does not mount the portrait image until its panel opens", () => {
    const view = renderPortrait(false);

    expect(screen.queryByAltText("Zephyr")).toBeNull();

    view.rerender(
      <CharacterPortraitPanel
        open
        name="Zephyr"
        imageSrc={portraitSrc}
        isStreaming={false}
        onClose={vi.fn()}
        onImageClick={vi.fn()}
      />,
    );

    const image = screen.getByAltText("Zephyr");
    expect(image.getAttribute("srcset")).toContain("w=480&q=80");
    expect(image.getAttribute("sizes")).toBe("max(12rem, calc((100vw - 48rem)/2 - 2rem))");
  });

  it("shows the portrait fallback when the image fails", () => {
    renderPortrait(true);
    fireEvent.error(screen.getByAltText("Zephyr"));

    expect(screen.queryByAltText("Zephyr")).toBeNull();
    expect(screen.getByText("No portrait")).toBeTruthy();
  });

  it("keeps the portrait mounted through its closing transition", () => {
    vi.useFakeTimers();
    const view = renderPortrait(true);

    view.rerender(
      <CharacterPortraitPanel
        open={false}
        name="Zephyr"
        imageSrc={portraitSrc}
        isStreaming={false}
        onClose={vi.fn()}
        onImageClick={vi.fn()}
      />,
    );

    expect(screen.getByAltText("Zephyr")).toBeTruthy();
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByAltText("Zephyr")).toBeNull();
  });

  it("does not mount the scene image until its panel opens", () => {
    const view = renderBackground(false);

    expect(screen.queryByAltText("Scene")).toBeNull();

    view.rerender(
      <CustomImagePanel
        open
        imageSrc={backgroundSrc}
        customImageSrc={null}
        onClose={vi.fn()}
        onImageClick={vi.fn()}
        onUploadImage={vi.fn()}
        onClearImage={vi.fn()}
      />,
    );

    const image = screen.getByAltText("Scene");
    expect(image.getAttribute("srcset")).toContain("v=background.png");
    expect(image.getAttribute("sizes")).toBe("max(12rem, calc((100vw - 48rem)/2 - 2rem))");
  });

  it("shows the scene fallback when the image fails", () => {
    renderBackground(true);
    fireEvent.error(screen.getByAltText("Scene"));

    expect(screen.queryByAltText("Scene")).toBeNull();
    expect(screen.getByText("No scene set")).toBeTruthy();
  });
});
