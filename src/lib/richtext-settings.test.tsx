// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { RichTextSettingsProvider, useRichTextSettings } from "./richtext-settings";

const KEY = "stv.richtext";

function Probe() {
  const settings = useRichTextSettings();
  return (
    <span data-testid="value">
      {[settings.blockExternalMedia, settings.highlightDialogue, settings.autoFixMarkdown].join(
        ",",
      )}
    </span>
  );
}

function renderProbe() {
  return render(
    <RichTextSettingsProvider>
      <Probe />
    </RichTextSettingsProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("richtext settings store", () => {
  it("uses defaults when nothing is stored", () => {
    renderProbe();
    expect(screen.getByTestId("value").textContent).toBe("false,true,true");
  });

  it("reads stored values on first render", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        blockExternalMedia: true,
        highlightDialogue: false,
        autoFixMarkdown: false,
      }),
    );
    renderProbe();
    expect(screen.getByTestId("value").textContent).toBe("true,false,false");
  });

  it("ignores malformed values", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ blockExternalMedia: "yes" }));
    renderProbe();
    expect(screen.getByTestId("value").textContent).toBe("false,true,true");
  });

  it("updates on a same-tab change from a setter", () => {
    renderProbe();
    act(() => {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({
          blockExternalMedia: true,
          highlightDialogue: false,
          autoFixMarkdown: true,
        }),
      );
      window.dispatchEvent(new Event("stv:richtext-change"));
    });
    expect(screen.getByTestId("value").textContent).toBe("true,false,true");
  });

  it("updates when another tab writes storage", () => {
    renderProbe();
    act(() => {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({
          blockExternalMedia: false,
          highlightDialogue: false,
          autoFixMarkdown: false,
        }),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    });
    expect(screen.getByTestId("value").textContent).toBe("false,false,false");
  });
});
