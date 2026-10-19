// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  SettingsSaveProvider,
  SettingsSaveStatus,
  getSaveState,
  useSettingsSaveStatus,
  type SaveState,
} from "./save-status";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness({
  source = "character",
  state,
  at,
  retry,
}: {
  source?: string;
  state: SaveState;
  at?: number;
  retry?: () => void;
}) {
  useSettingsSaveStatus(source, state, { at, retry });
  return <SettingsSaveStatus />;
}

describe("getSaveState", () => {
  it("maps mutation flags", () => {
    expect(getSaveState({ isPending: true, isError: false, isSuccess: false })).toBe("saving");
    expect(getSaveState({ isPending: false, isError: true, isSuccess: false })).toBe("error");
    expect(getSaveState({ isPending: false, isError: false, isSuccess: true })).toBe("saved");
    expect(getSaveState({ isPending: false, isError: false, isSuccess: false })).toBe("idle");
  });
});

describe("SettingsSaveStatus", () => {
  it("shows saving and then saved", () => {
    const { rerender } = render(
      <SettingsSaveProvider activeSection="character">
        <Harness state="saving" />
      </SettingsSaveProvider>,
    );

    expect(screen.getByText("Saving…")).toBeTruthy();

    rerender(
      <SettingsSaveProvider activeSection="character">
        <Harness state="saved" at={Date.now()} />
      </SettingsSaveProvider>,
    );
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("fades saved after the hold", () => {
    vi.useFakeTimers();
    render(
      <SettingsSaveProvider activeSection="character">
        <Harness state="saved" at={Date.now()} />
      </SettingsSaveProvider>,
    );
    expect(screen.getByText("Saved")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("shows a retry for errors", () => {
    const retry = vi.fn();
    render(
      <SettingsSaveProvider activeSection="character">
        <Harness state="error" retry={retry} />
      </SettingsSaveProvider>,
    );

    expect(screen.getByText("Couldn't save.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("ignores reports from a section that is not active", () => {
    render(
      <SettingsSaveProvider activeSection="character">
        <Harness source="prompts" state="error" />
      </SettingsSaveProvider>,
    );

    expect(screen.queryByText("Couldn't save.")).toBeNull();
  });

  it("does not replay a stale success when re-entering a section", () => {
    render(
      <SettingsSaveProvider activeSection="character">
        <Harness state="saved" at={Date.now() - 10_000} />
      </SettingsSaveProvider>,
    );

    expect(screen.queryByText("Saved")).toBeNull();
  });
});
