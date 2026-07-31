import { ChatRow } from "./chat-row";
import type { ChatListItem } from "@/server/fns/chats";

interface ChatDayGroupProps {
  label: string;
  chats: ChatListItem[];
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function ChatDayGroup({ label, chats, onRename, onDelete }: ChatDayGroupProps) {
  return (
    <section>
      <h3 className="text-2 text-sm font-medium mb-3 sticky top-14 z-10 bg-base/80 backdrop-blur-sm py-1">
        {label}
      </h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
        {chats.map((chat) => (
          <ChatRow key={chat.id} chat={chat} onRename={onRename} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}
