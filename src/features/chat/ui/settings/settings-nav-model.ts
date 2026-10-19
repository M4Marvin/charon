import type { LucideIcon } from "lucide-react";

export type SettingsScope = "chat" | "global" | "browser";

export interface SettingsSection {
  id: string;
  label: string;
  icon: LucideIcon;
  scope: SettingsScope;
}

export const SCOPE_LABELS: Record<SettingsScope, string> = {
  chat: "This chat",
  global: "All chats",
  browser: "This browser",
};

export function getVisibleNavGroups(
  sections: SettingsSection[],
): { id: SettingsScope; label: string; items: SettingsSection[] }[] {
  const groups = new Map<SettingsScope, SettingsSection[]>();

  for (const section of sections) {
    const group = groups.get(section.scope);
    if (group) {
      group.push(section);
    } else {
      groups.set(section.scope, [section]);
    }
  }

  return [...groups.entries()].map(([id, items]) => ({ id, label: SCOPE_LABELS[id], items }));
}
