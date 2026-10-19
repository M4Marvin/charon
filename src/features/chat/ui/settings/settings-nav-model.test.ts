import { describe, expect, it } from "vitest";
import type { SettingsSection } from "./settings-nav-model";
import {
  MODE_LABELS,
  SCOPE_LABELS,
  getModeForScope,
  getSectionsForMode,
} from "./settings-nav-model";

/** Real lucide icons aren't needed for grouping logic; a plain stub stands in. */
const icon = {} as SettingsSection["icon"];

const SECTIONS: SettingsSection[] = [
  { id: "character", label: "Character", icon, scope: "chat" },
  { id: "background", label: "Background", icon, scope: "chat" },
  { id: "chat-details", label: "Chat details", icon, scope: "chat" },
  { id: "model", label: "Model & preset", icon, scope: "global" },
  { id: "persona", label: "Your persona", icon, scope: "global" },
  { id: "lorebooks", label: "Lorebooks", icon, scope: "global" },
  { id: "prompts", label: "Global prompts", icon, scope: "global" },
  { id: "display", label: "Display", icon, scope: "browser" },
];

describe("settings modes", () => {
  it("puts chat-scoped sections in This chat", () => {
    expect(getSectionsForMode(SECTIONS, "chat").map((s) => s.id)).toEqual([
      "character",
      "background",
      "chat-details",
    ]);
  });

  it("puts global and browser sections in Defaults", () => {
    expect(getSectionsForMode(SECTIONS, "defaults").map((s) => s.id)).toEqual([
      "model",
      "persona",
      "lorebooks",
      "prompts",
      "display",
    ]);
  });

  it("maps scopes to modes", () => {
    expect(getModeForScope("chat")).toBe("chat");
    expect(getModeForScope("global")).toBe("defaults");
    expect(getModeForScope("browser")).toBe("defaults");
  });

  it("returns [] for empty input", () => {
    expect(getSectionsForMode([], "chat")).toEqual([]);
    expect(getSectionsForMode([], "defaults")).toEqual([]);
  });

  it("uses the documented labels", () => {
    expect(MODE_LABELS).toEqual({ chat: "This chat", defaults: "Defaults" });
    expect(SCOPE_LABELS).toEqual({
      chat: "This chat",
      global: "Applies to all chats",
      browser: "This browser",
    });
  });
});
