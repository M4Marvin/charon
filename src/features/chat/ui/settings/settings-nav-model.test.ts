import { describe, expect, it } from "vitest";
import type { SettingsSection } from "./settings-nav-model";
import { getVisibleNavGroups } from "./settings-nav-model";

/** Real lucide icons aren't needed for grouping logic; a plain stub stands in. */
const icon = {} as SettingsSection["icon"];

const ADMIN_SECTIONS: SettingsSection[] = [
  { id: "connection", label: "Connection", icon, adminOnly: true, group: "connection" },
  {
    id: "providers",
    label: "Providers",
    icon,
    adminOnly: true,
    group: "connection",
    secondary: true,
  },
  { id: "presets", label: "Presets", icon, adminOnly: true, group: "connection", secondary: true },
  { id: "persona", label: "Persona", icon, group: "chat" },
  { id: "lorebooks", label: "Lorebooks", icon, group: "chat" },
  { id: "prompts", label: "Prompts", icon, group: "chat" },
  { id: "character", label: "Character", icon, group: "chat" },
  { id: "scene", label: "Scene", icon, group: "chat" },
  { id: "display", label: "Display", icon, group: "display" },
];

describe("getVisibleNavGroups", () => {
  it("groups admin sections into [connection, chat, display] with labels and item counts", () => {
    const groups = getVisibleNavGroups(ADMIN_SECTIONS, true);

    expect(groups.map((g) => g.id)).toEqual(["connection", "chat", "display"]);
    expect(groups.map((g) => g.label)).toEqual(["Connection", "Chat", "Display"]);
    expect(groups.map((g) => g.items.length)).toEqual([3, 5, 1]);
  });

  it("omits the connection group entirely for non-admins", () => {
    const groups = getVisibleNavGroups(ADMIN_SECTIONS, false);

    expect(groups.map((g) => g.id)).toEqual(["chat", "display"]);
    expect(groups.map((g) => g.items.length)).toEqual([5, 1]);
    expect(groups.some((g) => g.id === "connection")).toBe(false);
  });

  it("preserves secondary flags through grouping", () => {
    const groups = getVisibleNavGroups(ADMIN_SECTIONS, true);
    const connection = groups.find((g) => g.id === "connection")!;

    expect(connection.items.map((s) => s.secondary)).toEqual([undefined, true, true]);
  });

  it("preserves input order of items within each group", () => {
    const groups = getVisibleNavGroups(ADMIN_SECTIONS, true);
    const chat = groups.find((g) => g.id === "chat")!;

    expect(chat.items.map((s) => s.id)).toEqual([
      "persona",
      "lorebooks",
      "prompts",
      "character",
      "scene",
    ]);
  });

  it("returns [] for empty input", () => {
    expect(getVisibleNavGroups([], true)).toEqual([]);
    expect(getVisibleNavGroups([], false)).toEqual([]);
  });
});
