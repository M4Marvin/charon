// @vitest-environment node
import { describe, expect, it } from "vitest";
import { diskPathFromStored } from "@/server/uploads";

describe("diskPathFromStored", () => {
  it("keeps valid stored paths under the uploads root", () => {
    expect(diskPathFromStored("uploads/personas/avatar.png")).toBe(
      "data/uploads/personas/avatar.png",
    );
  });

  it("rejects paths that escape the uploads root", () => {
    expect(() => diskPathFromStored("../outside.png")).toThrow("Invalid stored upload path");
    expect(() => diskPathFromStored("uploads/../../outside.png")).toThrow(
      "Invalid stored upload path",
    );
    expect(() => diskPathFromStored("local.db")).toThrow("Invalid stored upload path");
    expect(() => diskPathFromStored("uploads/../local.db")).toThrow("Invalid stored upload path");
    expect(() => diskPathFromStored("uploads/avatars/nested/image.png")).toThrow(
      "Invalid stored upload path",
    );
  });
});
