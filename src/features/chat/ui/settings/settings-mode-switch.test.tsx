// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SettingsModeSwitch } from "./settings-mode-switch";

afterEach(cleanup);

describe("SettingsModeSwitch", () => {
  it("marks the active mode and switches on click", () => {
    const onChange = vi.fn();
    render(<SettingsModeSwitch mode="chat" onChange={onChange} />);

    const scope = screen.getByRole("group", { name: "Settings scope" });
    const chat = screen.getByRole("button", { name: "This chat" });
    const defaults = screen.getByRole("button", { name: "Defaults" });

    expect(scope).toBeTruthy();
    expect(chat.getAttribute("aria-pressed")).toBe("true");
    expect(defaults.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(defaults);
    expect(onChange).toHaveBeenCalledWith("defaults");
  });
});
