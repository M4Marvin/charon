import type { LucideIcon } from "lucide-react";

export type SettingsScope = "chat" | "global" | "browser";
export type SettingsMode = "chat" | "defaults";

export interface SettingsSection {
  id: string;
  label: string;
  icon: LucideIcon;
  scope: SettingsScope;
}

export const SCOPE_LABELS: Record<SettingsScope, string> = {
  chat: "This chat",
  global: "Applies to all chats",
  browser: "This browser",
};

export const MODE_LABELS: Record<SettingsMode, string> = {
  chat: "This chat",
  defaults: "Defaults",
};

export function getModeForScope(scope: SettingsScope): SettingsMode {
  return scope === "chat" ? "chat" : "defaults";
}

export function getSectionsForMode(
  sections: SettingsSection[],
  mode: SettingsMode,
): SettingsSection[] {
  return sections.filter((section) => getModeForScope(section.scope) === mode);
}

export function getModeDescription(mode: SettingsMode): string {
  return mode === "chat"
    ? "Only this conversation changes."
    : "Shared by every chat. Display stays in this browser.";
}
