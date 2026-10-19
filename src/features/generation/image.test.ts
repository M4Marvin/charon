import { describe, expect, it } from "vitest";
import { assembleImagePrompt, canonicalIdentity, sanitizeImpersonation } from "./image";
import type { EffectiveCharacter } from "./contract";

const character: EffectiveCharacter = {
  name: "Aria",
  description: "",
  personality: "",
  scenario: "",
  systemPrompt: "",
  mesExample: "",
  postHistoryInstructions: "",
  depthPrompt: "",
  depthPromptDepth: 4,
  depthPromptRole: "system",
  creatorNotes: "",
  tags: ["1girl", "Silver Hair", "(red eyes)", "1girl", "oc"],
};

describe("image prompt assembly", () => {
  it("keeps a stable identity prefix and dedupes tags", () => {
    expect(canonicalIdentity(character)).toEqual(["1girl", "silver hair", "red eyes"]);
  });

  it("moves identity to the front and strips duplicates from the model delta", () => {
    const prompt = assembleImagePrompt(character, "silver hair, rain, city street, red eyes");
    expect(prompt.startsWith("1girl, silver hair, red eyes, rain, city street")).toBe(true);
    expect(prompt.match(/silver hair/g)).toHaveLength(1);
  });

  it("always appends the canonical style suffix", () => {
    expect(assembleImagePrompt(character, "rain")).toContain("painterly");
  });
});

describe("impersonation sanitizer", () => {
  it("strips a leading speaker label", () => {
    expect(sanitizeImpersonation("Aria: Hello there", "Aria")).toBe("Hello there");
  });
});
