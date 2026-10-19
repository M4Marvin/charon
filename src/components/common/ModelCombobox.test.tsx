// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const refetch = vi.fn();

vi.mock("@/hooks/useProviderModels", () => ({
  useProviderModels: () => ({
    data: [{ id: "model-a" }, { id: "model-b" }],
    isLoading: false,
    error: null,
    refetch,
  }),
}));

import { ModelCombobox } from "./ModelCombobox";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ModelCombobox", () => {
  it("does not commit or clear the model when the field is emptied and blurred", () => {
    const onChange = vi.fn();
    render(
      <ModelCombobox
        providerId="provider-1"
        value="model-a"
        onChange={onChange}
        ariaLabel="Default model"
      />,
    );

    const input = screen.getByLabelText("Default model") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("model-a");
  });

  it("commits a typed custom model on blur", () => {
    const onChange = vi.fn();
    render(
      <ModelCombobox
        providerId="provider-1"
        value="model-a"
        onChange={onChange}
        ariaLabel="Default model"
      />,
    );

    const input = screen.getByLabelText("Default model");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "custom/model" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith("custom/model");
  });

  it("commits a typed custom model on Enter", () => {
    const onChange = vi.fn();
    render(
      <ModelCombobox
        providerId="provider-1"
        value="model-a"
        onChange={onChange}
        ariaLabel="Default model"
      />,
    );

    const input = screen.getByLabelText("Default model");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "custom/model" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("custom/model");
  });

  it("disables the input until a provider is selected", () => {
    render(<ModelCombobox providerId="" value="" onChange={vi.fn()} ariaLabel="Default model" />);

    expect(screen.getByLabelText("Default model")).toHaveProperty("disabled", true);
  });
});
