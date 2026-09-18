import { describe, expect, it } from "vitest";
import { balanceMarkdown } from "./markdown";

describe("balanceMarkdown", () => {
  it("returns text unchanged when final", () => {
    expect(balanceMarkdown("*unclosed", true)).toBe("*unclosed");
  });

  it("closes single-character emphasis and quotes", () => {
    expect(balanceMarkdown("*bold", false)).toBe("*bold*");
    expect(balanceMarkdown("_bold", false)).toBe("_bold_");
    expect(balanceMarkdown('"quote', false)).toBe('"quote"');
  });

  it("closes multi-character openers with a matching run", () => {
    expect(balanceMarkdown("**bold", false)).toBe("**bold**");
    expect(balanceMarkdown("***bold", false)).toBe("***bold***");
    expect(balanceMarkdown("__bold", false)).toBe("__bold__");
    expect(balanceMarkdown("~~strike", false)).toBe("~~strike~~");
  });

  it("closes nested openers innermost first", () => {
    expect(balanceMarkdown("**bold *italic", false)).toBe("**bold *italic***");
  });

  it("does not treat list bullets or arithmetic as emphasis", () => {
    expect(balanceMarkdown("* first item", false)).toBe("* first item");
    expect(balanceMarkdown("a * b", false)).toBe("a * b");
    expect(balanceMarkdown("snake_case", false)).toBe("snake_case");
  });

  it("ignores delimiters inside inline code and escapes", () => {
    expect(balanceMarkdown("`a * b`", false)).toBe("`a * b`");
    expect(balanceMarkdown("`code` and *bold", false)).toBe("`code` and *bold*");
    expect(balanceMarkdown("c:\\path\\*", false)).toBe("c:\\path\\*");
  });

  it("closes fenced blocks on their own lines", () => {
    expect(balanceMarkdown("```js\ncode", false)).toBe("```js\ncode\n```");
    expect(balanceMarkdown("~~~\ncode", false)).toBe("~~~\ncode\n~~~");
  });

  it("ignores delimiters inside fenced blocks", () => {
    expect(balanceMarkdown("```\na * b\n```", false)).toBe("```\na * b\n```");
  });

  it("leaves balanced text untouched", () => {
    expect(balanceMarkdown("*bold* and `code`", false)).toBe("*bold* and `code`");
    expect(balanceMarkdown("", false)).toBe("");
  });
});
