import { ChatRow } from "./chat-row";
import type { ChatListItem } from "@/server/fns/chats";

interface ChatDayGroupProps {
  label: string;
  chats: ChatListItem[];
  now: Date;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function ChatDayGroup({ label, chats, now, onRename, onDelete }: ChatDayGroupProps) {
  return (
    <section>
      <h2 className="text-2 text-sm font-medium mb-3 sticky top-14 z-10 bg-(--bg-base)/80 backdrop-blur-sm py-1">
        {label}
      </h2>
      <ul className="grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
        {chats.map((chat) => (
          <ChatRow key={chat.id} chat={chat} now={now} onRename={onRename} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  );
}
