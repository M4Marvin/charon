import { describe, expect, it } from "vitest";
import { getPath, parsePath, setPath } from "./card-path.js";

describe("parsePath", () => {
  it("splits dotted keys", () => {
    expect(parsePath("data.name")).toEqual(["data", "name"]);
  });

  it("parses array indexes", () => {
    expect(parsePath("data.alternate_greetings[2]")).toEqual(["data", "alternate_greetings", 2]);
    expect(parsePath("data.entries[0].keys[1]")).toEqual(["data", "entries", 0, "keys", 1]);
  });

  it("rejects empty paths", () => {
    expect(() => parsePath("")).toThrow();
  });
});

describe("getPath / setPath", () => {
  it("reads nested values and indexes", () => {
    const card = { data: { name: "Mia", alternate_greetings: ["a", "b"] } };
    expect(getPath(card, parsePath("data.name"))).toBe("Mia");
    expect(getPath(card, parsePath("data.alternate_greetings[1]"))).toBe("b");
    expect(getPath(card, parsePath("data.missing.deep"))).toBeUndefined();
  });

  it("creates missing objects and arrays", () => {
    const card: Record<string, unknown> = {};
    setPath(card, parsePath("data.alternate_greetings[0]"), "hello");
    expect(getPath(card, parsePath("data.alternate_greetings[0]"))).toBe("hello");
  });

  it("overwrites leaf values", () => {
    const card = { data: { name: "old" } };
    setPath(card, parsePath("data.name"), "new");
    expect(getPath(card, parsePath("data.name"))).toBe("new");
  });
});
