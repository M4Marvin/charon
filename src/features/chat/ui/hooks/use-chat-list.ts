import { useMemo, useState } from "react";
import { useChats } from "@/hooks/useChats";
import type { ChatListItem } from "@/server/fns/chats";

const DAY_GROUPS = ["Today", "Yesterday", "Previous 7 days", "Older"] as const;

function dayGroup(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  if (d >= today) return "Today";
  if (d >= yesterday) return "Yesterday";
  if (d >= weekAgo) return "Previous 7 days";
  return "Older";
}

export function useChatList() {
  const { data: chats, isLoading, error } = useChats();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!chats) return [];
    if (!search.trim()) return chats;
    const q = search.toLowerCase();
    return chats.filter(
      (c) => c.title.toLowerCase().includes(q) || c.characterName.toLowerCase().includes(q),
    );
  }, [chats, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ChatListItem[]>();
    for (const chat of filtered) {
      const k = dayGroup(chat.updatedAt);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(chat);
    }
    return groups;
  }, [filtered]);

  return { chats, filtered, grouped, search, setSearch, isLoading, error };
}

export { DAY_GROUPS };
