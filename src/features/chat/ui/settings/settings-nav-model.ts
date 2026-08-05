import type { LucideIcon } from "lucide-react";

export interface SettingsSection {
  id: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  group: "connection" | "chat" | "display";
  secondary?: boolean;
}

export const GROUP_LABELS: Record<SettingsSection["group"], string> = {
  connection: "Connection",
  chat: "Chat",
  display: "Display",
};

export function getVisibleNavGroups(
  sections: SettingsSection[],
  isAdmin: boolean,
): { id: SettingsSection["group"]; label: string; items: SettingsSection[] }[] {
  const groups = new Map<SettingsSection["group"], SettingsSection[]>();

  for (const section of sections) {
    if (section.adminOnly && !isAdmin) continue;

    const group = groups.get(section.group);
    if (group) {
      group.push(section);
    } else {
      groups.set(section.group, [section]);
    }
  }

  return [...groups.entries()].map(([id, items]) => ({ id, label: GROUP_LABELS[id], items }));
}
