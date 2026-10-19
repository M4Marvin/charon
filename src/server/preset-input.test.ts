import { describe, expect, it } from "vitest";
import { validateCreatePresetInput, validateUpdatePresetInput } from "./preset-input";

const data = { temperature: 1, topP: 0.9, maxTokens: 1200 };

describe("validateCreatePresetInput", () => {
  it("accepts a preset without a provider or model", () => {
    expect(validateCreatePresetInput({ name: "Sparse", data })).toEqual({
      name: "Sparse",
      providerId: null,
      model: null,
      data,
    });
  });

  it("accepts present-but-undefined keys from the transport", () => {
    expect(
      validateCreatePresetInput({ name: "Sparse", providerId: undefined, model: undefined, data }),
    ).toMatchObject({ providerId: null, model: null });
  });

  it("accepts explicit nulls and empty strings", () => {
    expect(
      validateCreatePresetInput({ name: "Sparse", providerId: "", model: "   ", data }),
    ).toMatchObject({ providerId: null, model: null });
    expect(
      validateCreatePresetInput({ name: "Sparse", providerId: null, model: null, data }),
    ).toMatchObject({ providerId: null, model: null });
  });

  it("keeps and trims a real provider and model", () => {
    expect(
      validateCreatePresetInput({ name: "  Main  ", providerId: " p1 ", model: " m1 ", data }),
    ).toEqual({ name: "Main", providerId: "p1", model: "m1", data });
  });

  it("rejects a blank name", () => {
    expect(() => validateCreatePresetInput({ name: "   ", data })).toThrow("Invalid preset input");
  });

  it("rejects invalid preset data", () => {
    expect(() => validateCreatePresetInput({ name: "Bad", data: { temperature: "hot" } })).toThrow(
      "Invalid preset data",
    );
  });
});

describe("validateUpdatePresetInput", () => {
  it("drops undefined optional keys instead of failing", () => {
    expect(validateUpdatePresetInput({ id: "p1", providerId: undefined })).toEqual({ id: "p1" });
  });

  it("preserves null and validates data when present", () => {
    expect(validateUpdatePresetInput({ id: "p1", providerId: null, data })).toEqual({
      id: "p1",
      providerId: null,
      data,
    });
  });

  it("rejects a blank name", () => {
    expect(() => validateUpdatePresetInput({ id: "p1", name: " " })).toThrow(
      "Invalid preset update",
    );
  });
});
