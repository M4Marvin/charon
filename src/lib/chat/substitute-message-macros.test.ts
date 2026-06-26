import { describe, expect, it } from "vitest";
import { substituteMessageMacros } from "./substitute-message-macros.js";

const env = { char: "Alice", user: "Marv" };

describe("substituteMessageMacros", () => {
  it("replaces {{char}} with char name", () => {
    expect(substituteMessageMacros("Hello {{char}}!", env)).toBe("Hello Alice!");
  });

  it("replaces {{user}} with user name", () => {
    expect(substituteMessageMacros("Hello {{user}}!", env)).toBe("Hello Marv!");
  });

  it("replaces both {{char}} and {{user}}", () => {
    expect(substituteMessageMacros("{{char}} says hi to {{user}}", env)).toBe(
      "Alice says hi to Marv",
    );
  });

  it("replaces multiple occurrences", () => {
    expect(
      substituteMessageMacros("{{char}} and {{char}} and {{user}} and {{user}}", env),
    ).toBe("Alice and Alice and Marv and Marv");
  });

  it("is case-insensitive for {{CHAR}}", () => {
    expect(substituteMessageMacros("Hello {{CHAR}}!", env)).toBe("Hello Alice!");
  });

  it("is case-insensitive for {{User}}", () => {
    expect(substituteMessageMacros("Hello {{User}}!", env)).toBe("Hello Marv!");
  });

  it("returns text unchanged when no macros present", () => {
    expect(substituteMessageMacros("Hello world!", env)).toBe("Hello world!");
  });

  it("returns empty string unchanged", () => {
    expect(substituteMessageMacros("", env)).toBe("");
  });
});
