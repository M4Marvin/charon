// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CharacterPortraitPanel } from "./character-portrait-panel";
import { CustomImagePanel } from "./custom-image-panel";
import { RenameChatDialog } from "./rename-chat-dialog";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const portraitSrc = "/api/characters/character-1/avatar?v=portrait.png";
const backgroundSrc = "/api/backgrounds/background-1/image?v=background.png";
const panelSizes = "min(24rem, max(12rem, calc((100vw - 48rem)/2 - 2rem)))";

function renderPortrait(
  open: boolean,
  overrides: Partial<Parameters<typeof CharacterPortraitPanel>[0]> = {},
) {
  return render(
    <CharacterPortraitPanel
      open={open}
      name="Zephyr"
      imageSrc={portraitSrc}
      isStreaming={false}
      onClose={vi.fn()}
      onImageClick={vi.fn()}
      {...overrides}
    />,
  );
}

function renderBackground(
  open: boolean,
  overrides: Partial<Parameters<typeof CustomImagePanel>[0]> = {},
) {
  return render(
    <CustomImagePanel
      open={open}
      imageSrc={backgroundSrc}
      customImageSrc={null}
      onClose={vi.fn()}
      onImageClick={vi.fn()}
      onUploadImage={vi.fn()}
      onClearImage={vi.fn()}
      {...overrides}
    />,
  );
}

describe("off-canvas image panels", () => {
  it("does not mount the portrait image until its panel opens", () => {
    const view = renderPortrait(false);

    expect(screen.queryByAltText("Zephyr portrait")).toBeNull();

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

    const image = screen.getByAltText("Zephyr portrait");
    expect(image.getAttribute("srcset")).toContain("w=480&q=80");
    expect(image.getAttribute("sizes")).toBe(panelSizes);
  });

  it("shows the portrait fallback when the image fails", () => {
    renderPortrait(true);
    fireEvent.error(screen.getByAltText("Zephyr portrait"));

    expect(screen.queryByAltText("Zephyr portrait")).toBeNull();
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

    expect(screen.getByAltText("Zephyr portrait")).toBeTruthy();
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByAltText("Zephyr portrait")).toBeNull();
  });

  it("does not mount the scene image until its panel opens", () => {
    const view = renderBackground(false);

    expect(screen.queryByAltText("Scene image")).toBeNull();

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

    const image = screen.getByAltText("Scene image");
    expect(image.getAttribute("srcset")).toContain("v=background.png");
    expect(image.getAttribute("sizes")).toBe(panelSizes);
  });

  it("shows the scene fallback when the image fails and retries on reopen", () => {
    const view = renderBackground(true);
    fireEvent.error(screen.getByAltText("Scene image"));

    expect(screen.queryByAltText("Scene image")).toBeNull();
    expect(screen.getByText("No scene set")).toBeTruthy();

    view.rerender(
      <CustomImagePanel
        open={false}
        imageSrc={backgroundSrc}
        customImageSrc={null}
        onClose={vi.fn()}
        onImageClick={vi.fn()}
        onUploadImage={vi.fn()}
        onClearImage={vi.fn()}
      />,
    );
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

    expect(screen.getByAltText("Scene image")).toBeTruthy();
  });

  it("passes the custom-image alt through", () => {
    renderBackground(true, { alt: "Rooftop at dusk" });

    expect(screen.getByAltText("Rooftop at dusk")).toBeTruthy();
  });

  it("uses the panel ids referenced by the header", () => {
    renderPortrait(false);
    expect(document.getElementById("character-portrait-panel")).toBeTruthy();

    cleanup();
    renderBackground(false);
    expect(document.getElementById("custom-image-panel")).toBeTruthy();
  });

  it("does not expose a dead button when there is no portrait", () => {
    renderPortrait(true, { imageSrc: null });

    expect(screen.queryByRole("button", { name: "View Zephyr portrait" })).toBeNull();
    expect(screen.getByText("No portrait")).toBeTruthy();
    const panel = document.getElementById("character-portrait-panel");
    expect(panel?.firstElementChild?.getAttribute("tabindex")).toBe("-1");
  });

  it("opens the portrait with Enter and Space", () => {
    const onImageClick = vi.fn();
    renderPortrait(true, { onImageClick });

    const target = screen.getByRole("button", { name: "View Zephyr portrait" });
    fireEvent.keyDown(target, { key: "Enter" });
    fireEvent.keyDown(target, { key: " " });

    expect(onImageClick).toHaveBeenCalledTimes(2);
  });

  it("focuses the close button and closes on Escape", () => {
    const onClose = vi.fn();
    renderPortrait(true, { onClose });

    expect(document.activeElement).toBe(screen.getByLabelText("Close portrait panel"));

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("confirms before clearing a custom image", () => {
    const onClearImage = vi.fn();
    renderBackground(true, {
      customImageSrc: "data:image/png;base64,abc",
      onClearImage,
    });

    fireEvent.click(screen.getByLabelText("Clear custom image"));
    expect(onClearImage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Clear image" }));
    expect(onClearImage).toHaveBeenCalledTimes(1);
  });

  it("does not close the panel when Escape dismisses the clear confirmation", () => {
    const onClose = vi.fn();
    renderBackground(true, {
      customImageSrc: "data:image/png;base64,abc",
      onClose,
    });

    fireEvent.click(screen.getByLabelText("Clear custom image"));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("RenameChatDialog", () => {
  it("starts with the current title and saves it without an empty-title error", () => {
    const onClose = vi.fn();
    render(
      <RenameChatDialog
        chat={{ id: "c1", title: "Old title" }}
        loading={false}
        onClose={onClose}
        onRename={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Title") as HTMLInputElement;
    expect(input.value).toBe("Old title");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("announces an empty-title error and links it to the input", () => {
    render(
      <RenameChatDialog
        chat={{ id: "c1", title: "Old title" }}
        loading={false}
        onClose={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Title");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Title cannot be empty.");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
  });
});
