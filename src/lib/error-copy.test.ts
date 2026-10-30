import { describe, expect, it } from "vitest";
import { friendlyImportError, friendlyLoadError } from "./error-copy";

describe("friendlyLoadError", () => {
  it("turns transport failures into actionable copy", () => {
    expect(friendlyLoadError(new Error("Failed to fetch"), "Fallback")).toContain(
      "Couldn't reach the server",
    );
    expect(friendlyLoadError(new Error("fetch failed"), "Fallback")).toContain(
      "Couldn't reach the server",
    );
    expect(
      friendlyLoadError(new Error("connect ECONNREFUSED 127.0.0.1:3000"), "Fallback"),
    ).toContain("Couldn't reach the server");
  });

  it("never leaks an unknown server message", () => {
    expect(
      friendlyLoadError(new Error("SQLITE_CONSTRAINT: unique"), "Couldn't load settings."),
    ).toBe("Couldn't load settings.");
    expect(friendlyLoadError(undefined, "Couldn't load settings.")).toBe("Couldn't load settings.");
  });
});

describe("friendlyImportError", () => {
  it("turns card-spec parser errors into a recovery instruction", () => {
    expect(friendlyImportError(new Error("No PNG metadata."))).toContain(
      "doesn't contain a character card",
    );
    expect(friendlyImportError("No character data in chara chunk")).toContain(
      "doesn't contain a character card",
    );
  });

  it("keeps server-unreachable copy and hides unknown details", () => {
    expect(friendlyImportError(new Error("Failed to fetch"))).toContain(
      "Couldn't reach the server",
    );
    expect(friendlyImportError(new Error("EBADF"))).toBe(
      "Couldn't read that file. Try a character card PNG.",
    );
  });
});
