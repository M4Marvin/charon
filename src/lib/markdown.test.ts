// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown with autoFixMarkdown", () => {
  it("leaves bullet lists alone", () => {
    const html = renderMarkdown("* a\n* b", { autoFixMarkdown: true });
    expect(html).toContain("<li>a</li>");
    expect(html).toContain("<li>b</li>");
    expect(html).not.toContain("a*");
    expect(html).not.toContain("b*");
  });

  it("does not turn arithmetic into emphasis", () => {
    const html = renderMarkdown("2*3", { autoFixMarkdown: true });
    expect(html).toContain("2*3");
    expect(html).not.toContain("<em>");
  });

  it("does not append delimiters inside fenced code", () => {
    const html = renderMarkdown("```sh\nls *.ts\n```", { autoFixMarkdown: true });
    expect(html).toContain("ls *.ts");
    expect(html).not.toContain("*.ts*");
  });

  it("does not normalize spacing inside inline code", () => {
    const html = renderMarkdown("`** bold **`", { autoFixMarkdown: true });
    expect(html).toContain("<code>** bold **</code>");
  });

  it("still normalizes spaces around emphasis delimiters", () => {
    const html = renderMarkdown("** bold **", { autoFixMarkdown: true });
    expect(html).toContain("<strong>bold</strong>");
  });

  it("keeps emphasis inside list items", () => {
    const italic = renderMarkdown("* *italic* rest", { autoFixMarkdown: true });
    expect(italic).toContain("<li><em>italic</em> rest</li>");

    const bold = renderMarkdown("* **bold** item", { autoFixMarkdown: true });
    expect(bold).toContain("<li><strong>bold</strong> item</li>");
  });

  it("does not rewrite inline code inside emphasis", () => {
    const html = renderMarkdown("**a `x * y` c**", { autoFixMarkdown: true });
    expect(html).toContain("<code>x * y</code>");
    expect(html).toContain("<strong>");
  });

  it("leaves an asterisk in list text alone", () => {
    const html = renderMarkdown("* a * b", { autoFixMarkdown: true });
    expect(html).toContain("<li>a * b</li>");
  });

  it("leaves indented code blocks alone", () => {
    const html = renderMarkdown("    * literal *", { autoFixMarkdown: true });
    expect(html).toContain("<pre><code>* literal *");
    expect(html).not.toContain("<em>");
  });

  it("leaves list text inside blockquotes alone", () => {
    const html = renderMarkdown("> * a * b", { autoFixMarkdown: true });
    expect(html).toContain("a * b");
    expect(html).not.toContain("<em>");
  });
});

describe("renderMarkdown sanitizer", () => {
  it("strips inline styles and interactive form elements", () => {
    const html = renderMarkdown(
      '<div style="position:fixed;inset:0">overlay</div>' +
        '<form><input value="x"><button>Go</button><textarea>t</textarea>' +
        "<select><option>x</option></select></form>",
      {},
    );

    expect(html).toContain("overlay");
    expect(html).not.toContain("style=");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("<option");
  });

  it("keeps scoped style blocks working when a scope is provided", () => {
    const html = renderMarkdown('<style>.foo{color:red}</style><p class="foo">hi</p>', {
      scopeId: "rt-test",
    });

    expect(html).toContain('<style class="rt-scoped">');
    expect(html).toContain(".rt-test .custom-foo");
  });

  it("still hardens links", () => {
    const html = renderMarkdown("[example](https://example.com)", {});

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });
});
