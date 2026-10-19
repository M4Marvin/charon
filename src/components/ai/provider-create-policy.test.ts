import { describe, expect, it } from "vitest";
import { shouldAdoptCreatedProvider } from "./provider-create-policy";

describe("shouldAdoptCreatedProvider", () => {
  it("adopts the first provider", () => {
    expect(shouldAdoptCreatedProvider(undefined)).toBe(true);
    expect(shouldAdoptCreatedProvider([])).toBe(true);
  });

  it("never replaces an existing default", () => {
    expect(shouldAdoptCreatedProvider([{ id: "p1" }])).toBe(false);
    expect(shouldAdoptCreatedProvider([{ id: "p1" }, { id: "p2" }])).toBe(false);
  });
});
