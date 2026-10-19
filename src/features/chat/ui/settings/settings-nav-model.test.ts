import { describe, expect, it } from "vitest";
import type { SettingsSection } from "./settings-nav-model";
import { SCOPE_LABELS, getVisibleNavGroups } from "./settings-nav-model";

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

describe("getVisibleNavGroups", () => {
  it("groups sections by scope with labels and item counts", () => {
    const groups = getVisibleNavGroups(SECTIONS);

    expect(groups.map((g) => g.id)).toEqual(["chat", "global", "browser"]);
    expect(groups.map((g) => g.label)).toEqual(["This chat", "All chats", "This browser"]);
    expect(groups.map((g) => g.items.length)).toEqual([3, 4, 1]);
  });

  it("preserves input order within each group", () => {
    const groups = getVisibleNavGroups(SECTIONS);

    expect(groups[0].items.map((s) => s.id)).toEqual(["character", "background", "chat-details"]);
    expect(groups[1].items.map((s) => s.id)).toEqual(["model", "persona", "lorebooks", "prompts"]);
  });

  it("returns [] for empty input", () => {
    expect(getVisibleNavGroups([])).toEqual([]);
  });

  it("uses the documented scope labels everywhere", () => {
    expect(SCOPE_LABELS).toEqual({
      chat: "This chat",
      global: "All chats",
      browser: "This browser",
    });
  });
});
