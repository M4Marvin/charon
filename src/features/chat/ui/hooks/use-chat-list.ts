import { useEffect, useMemo, useState } from "react";
import { startOfDay, subDays } from "date-fns";
import { useChats } from "@/hooks/useChats";
import type { ChatListItem } from "@/server/fns/chats";

const DAY_GROUPS = ["Today", "Yesterday", "Previous 7 days", "Older"] as const;

export function dayGroup(date: Date, now = new Date()): string {
  const today = startOfDay(now);
  const target = startOfDay(date);

  if (target >= today) return "Today";
  if (target >= subDays(today, 1)) return "Yesterday";
  if (target >= subDays(today, 7)) return "Previous 7 days";
  return "Older";
}

export function useChatList() {
  const { data: chats, isLoading, error } = useChats();
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    if (!chats) return [];
    const q = search.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(
      (c) => c.title.toLowerCase().includes(q) || c.characterName.toLowerCase().includes(q),
    );
  }, [chats, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ChatListItem[]>();
    for (const chat of filtered) {
      const k = dayGroup(chat.updatedAt, now);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(chat);
    }
    return groups;
  }, [filtered, now]);

  return { chats, filtered, grouped, search, setSearch, isLoading, error, now };
}

export { DAY_GROUPS };
