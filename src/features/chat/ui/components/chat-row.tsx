import { ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RelativeTime } from "@/components/common/RelativeTime";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import type { ChatListItem } from "@/server/fns/chats";
import { getChatMessages } from "@/server/fns/chats";
import { getChatConfigFn } from "@/features/chat/config/fns";
import { chatKeys } from "@/hooks/useChats";
import { chatConfigKeys } from "@/hooks/useChatConfig";
import { withImageVersion } from "@/lib/image-optimization";

interface ChatRowProps {
  chat: ChatListItem;
  now?: Date;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function ChatRow({ chat, now, onRename, onDelete }: ChatRowProps) {
  const queryClient = useQueryClient();
  // Warm the chat page queries so opening the chat paints from cache. The
  // messages read is cheap; config resolution does several local reads and
  // logs, but the 30s default staleTime bounds how often a re-hover refetches.
  const prefetchChat = () => {
    void queryClient.prefetchQuery({
      queryKey: chatKeys.messages(chat.id),
      queryFn: () => getChatMessages({ data: { id: chat.id } }),
    });
    void queryClient.prefetchQuery({
      queryKey: chatConfigKeys.detail(chat.id),
      queryFn: () => getChatConfigFn({ data: { chatId: chat.id } }),
    });
  };
  return (
    <li
      className="group relative flex items-center gap-4 rounded-xl border border-subtle bg-surface px-4 py-3 transition-colors hover:border-brand/40"
      onMouseEnter={prefetchChat}
      onFocus={prefetchChat}
    >
      <Link
        to="/chat/$id"
        params={{ id: chat.id }}
        aria-label={`Open chat ${chat.title}`}
        className="absolute inset-0 rounded-xl focus-ring z-0"
      />
      <Avatar className="size-11 shrink-0 rounded-full">
        <AvatarImage
          src={
            chat.characterImagePath
              ? withImageVersion(
                  `/api/characters/${chat.characterId}/avatar`,
                  chat.characterImagePath,
                )
              : undefined
          }
          alt=""
          className="object-cover"
        />
        <AvatarFallback className="rounded-full bg-brand/20 text-brand text-lg">
          {Array.from(chat.characterName)[0]?.toUpperCase() ?? "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-headline truncate" title={chat.title}>
          {chat.title}
        </p>
        {chat.lastMessagePreview ? (
          <p className="text-2 text-sm line-clamp-1" title={chat.lastMessagePreview}>
            {chat.lastMessagePreview}
          </p>
        ) : null}
        {chat.characterName !== chat.title || chat.userMessageCount > 0 ? (
          <p className="text-2 text-xs truncate">
            {chat.characterName !== chat.title ? chat.characterName : null}
            {chat.characterName !== chat.title && chat.userMessageCount > 0 ? " · " : null}
            {chat.userMessageCount > 0 ? (
              <span className="tabular-nums">
                {chat.userMessageCount} {chat.userMessageCount === 1 ? "turn" : "turns"}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0 relative">
        <span className="text-2 text-xs tabular-nums" title={chat.updatedAt.toLocaleString()}>
          <RelativeTime date={chat.updatedAt} now={now} compact />
        </span>
        <Link
          to="/characters/$id"
          params={{ id: chat.characterId }}
          aria-label={`View ${chat.characterName}`}
          className="inline-flex size-10 items-center justify-center rounded-lg text-2 transition-colors hover:text-brand focus-ring"
        >
          <ExternalLink className="size-4" />
        </Link>
      </div>
      <div className="relative opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 has-aria-expanded:opacity-100">
        <RowActionsMenu
          label={`Actions for ${chat.title}`}
          items={[
            {
              label: "Rename",
              onSelect: () => onRename(chat.id, chat.title),
            },
            {
              label: "Delete",
              destructive: true,
              onSelect: () => onDelete(chat.id),
            },
          ]}
        />
      </div>
    </li>
  );
}
