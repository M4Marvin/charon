import { describe, expect, it } from "vitest";
import { metadataField, metadataTags } from "./discovery.js";

describe("metadata parsing", () => {
  it("reads the tag list and ignores backticked words in the prose below it", () => {
    const md = "## Tags (2)\n\n`NSFW`, `Milf`\n\n`Incest` stays for search reasons.\n";
    expect(metadataTags(md)).toEqual(["NSFW", "Milf"]);
  });
  it("reads a field row", () => {
    expect(metadataField("| Name | `Amanda & Mia` |", "Name")).toBe("Amanda & Mia");
  });
});
