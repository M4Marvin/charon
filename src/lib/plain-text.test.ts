import { describe, expect, it } from "vitest";
import { plainExcerpt, toPlainText, truncateText } from "./plain-text";

describe("toPlainText", () => {
  it("strips markdown emphasis and returns readable prose", () => {
    expect(toPlainText("**Mimesis: Shapeshifting Roommate** — a friend.")).toBe(
      "Mimesis: Shapeshifting Roommate — a friend.",
    );
    expect(toPlainText("*Jennifer blinks.* She sits.")).toBe("Jennifer blinks. She sits.");
  });

  it("removes html, style blocks and css", () => {
    const raw =
      '<div style="background: linear-gradient(165deg, #180507 0%);"><style>.card { transition: all 0.3s; }</style><p>Hello <strong>world</strong></p></div>';
    const text = toPlainText(raw);
    expect(text).toBe("Hello world");
    expect(text).not.toContain("linear-gradient");
    expect(text).not.toContain("transition");
  });

  it("drops image syntax and template tokens", () => {
    expect(toPlainText("![alt](https://x.test/a.png) {{user}} greets {{char}}.")).toBe("greets.");
    expect(toPlainText("{{user}} is here")).toBe("is here");
  });

  it("unwraps links but keeps their text", () => {
    expect(toPlainText("[my cards](https://rentry.co/x)")).toBe("my cards");
  });

  it("normalises whitespace and entities", () => {
    expect(toPlainText("a\n\n  b &amp; c&nbsp;d")).toBe("a b & c d");
  });

  it("handles empty and nullish input", () => {
    expect(toPlainText(null)).toBe("");
    expect(toPlainText(undefined)).toBe("");
    expect(toPlainText("")).toBe("");
    expect(toPlainText("<style>a{}</style>")).toBe("");
  });

  it("keeps inline code content", () => {
    expect(toPlainText("Run `pnpm test` now")).toBe("Run pnpm test now");
  });
});

describe("truncateText", () => {
  it("does not split surrogate pairs", () => {
    expect(truncateText("😀😀😀", 2)).toBe("😀😀…");
  });

  it("leaves short text untouched", () => {
    expect(truncateText("short", 10)).toBe("short");
  });
});

describe("plainExcerpt", () => {
  it("caps output length", () => {
    const out = plainExcerpt("word ".repeat(100), { max: 20 });
    expect(Array.from(out).length).toBeLessThanOrEqual(21);
    expect(out.endsWith("…")).toBe(true);
  });
});
