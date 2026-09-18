import { describe, expect, it } from "vitest";
import { balanceMarkdown } from "./markdown";

describe("balanceMarkdown", () => {
  it("returns text unchanged when final", () => {
    expect(balanceMarkdown("*unclosed", true)).toBe("*unclosed");
  });

  it("closes an unpaired asterisk or quote inline", () => {
    expect(balanceMarkdown("*bold", false)).toBe("*bold*");
    expect(balanceMarkdown('"quote', false)).toBe('"quote"');
  });

  it("closes fenced blocks on their own lines", () => {
    expect(balanceMarkdown("```js\ncode", false)).toBe("```js\ncode\n```");
    expect(balanceMarkdown("~~~\ncode", false)).toBe("~~~\ncode\n~~~");
  });

  it("leaves balanced text untouched", () => {
    expect(balanceMarkdown("*bold* and `code`", false)).toBe("*bold* and `code`");
    expect(balanceMarkdown("", false)).toBe("");
  });
});
