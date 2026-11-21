import { describe, expect, it } from "vitest";
import { checkCard } from "./check.js";
import type { CardPackage } from "./types.js";

const IMAGE = "https://files.example/media/card/g01.jpg";

function pkg(overrides: Partial<CardPackage> = {}): CardPackage {
  return {
    dir: "/tmp/card",
    name: "card",
    page: `<svg><style>.x{color:red}</style></svg><div class="page"><p>page</p></div>`,
    personality: "Narrator rules. Second person.",
    tagline: "<-- 💬 1  |  🖼 1 --> hook",
    greetings: [{ id: "first_message", text: `*Beat.* "Line."\n\n![](${IMAGE})`, images: [IMAGE] }],
    images: [IMAGE],
    ...overrides,
  };
}

describe("checkCard", () => {
  it("passes a clean package", async () => {
    const result = await checkCard(pkg());
    expect(result.issues.filter((issue) => issue.level === "error")).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("fails when the tagline counts disagree", async () => {
    const result = await checkCard(pkg({ tagline: "<-- 💬 3  |  🖼 2 --> hook" }));
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["badge-mismatch", "image-count-mismatch"]),
    );
  });

  it("fails a greeting with no image", async () => {
    const result = await checkCard(
      pkg({
        tagline: "<-- 💬 1  |  🖼 0 --> hook",
        images: [],
        greetings: [{ id: "first_message", text: "*Beat.*", images: [] }],
      }),
    );
    expect(result.issues.map((issue) => issue.code)).toContain("greeting-no-image");
  });

  it("fails an image that is not last", async () => {
    const result = await checkCard(
      pkg({
        greetings: [
          { id: "first_message", text: `*Beat.*\n![](${IMAGE})\nmore text`, images: [IMAGE] },
        ],
        tagline: "<-- 💬 1  |  🖼 1 --> hook",
        images: [IMAGE],
      }),
    );
    expect(result.issues.map((issue) => issue.code)).toContain("image-not-last");
  });

  it("fails speaker labels", async () => {
    const result = await checkCard(
      pkg({
        greetings: [
          { id: "first_message", text: `**Mia:** hello\n![](${IMAGE})`, images: [IMAGE] },
        ],
      }),
    );
    expect(result.issues.map((issue) => issue.code)).toContain("speaker-labels");
  });

  it("fails an unwrapped style block and an oversized one", async () => {
    const unwrapped = await checkCard(pkg({ page: "<style>.x{}</style>" }));
    expect(unwrapped.issues.map((issue) => issue.code)).toContain("style-unwrapped");

    const big = await checkCard(pkg({ page: `<svg><style>${"a{}".repeat(6000)}</style></svg>` }));
    expect(big.issues.map((issue) => issue.code)).toContain("css-too-big");
  });

  it("warns when the bible still says to label speakers", async () => {
    const result = await checkCard(
      pkg({ personality: "Narrator. Begin paragraphs with **Name:**." }),
    );
    expect(result.issues.map((issue) => issue.code)).toContain("label-instruction");
  });
});
