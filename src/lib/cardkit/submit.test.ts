import { describe, expect, it } from "vitest";
import { editUrlFor } from "./submit.js";

describe("editUrlFor", () => {
  it("turns a character URL into its edit URL", () => {
    expect(editUrlFor("https://chub.ai/characters/SmutFixer/amanda-mia-2a0eccecd4e6")).toBe(
      "https://chub.ai/edit/SmutFixer/amanda-mia-2a0eccecd4e6",
    );
  });
  it("ignores anything that is not a character URL", () => {
    expect(editUrlFor(null)).toBeNull();
    expect(editUrlFor("https://chub.ai/edit/a/b")).toBeNull();
  });
});
