import { ArrowUpRight } from "lucide-react";
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
import { plainExcerpt } from "@/lib/plain-text";

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

  const sameName = chat.characterName === chat.title;

  return (
    <li
      className="group relative rounded-xl border border-subtle bg-surface p-4 transition-colors hover:border-brand/40"
      onMouseEnter={prefetchChat}
      onFocus={prefetchChat}
    >
      <Link
        to="/chat/$id"
        params={{ id: chat.id }}
        aria-label={`Open chat ${chat.title}`}
        className="absolute inset-0 rounded-xl focus-ring z-0"
      />

      <div className="flex gap-3.5">
        <Avatar className="size-12 shrink-0 rounded-full">
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

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-headline" title={chat.title}>
              {chat.title}
            </h3>
            <span
              className="shrink-0 text-xs text-2 tabular-nums"
              title={chat.updatedAt.toLocaleString()}
            >
              <RelativeTime date={chat.updatedAt} now={now} compact />
            </span>
            <div className="relative z-10 -my-2 -mr-1 shrink-0 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 has-aria-expanded:opacity-100">
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
          </div>

          <p
            className="mt-1 min-h-10 text-sm leading-5 text-2 line-clamp-2"
            title={chat.lastMessagePreview ?? undefined}
          >
            {chat.lastMessagePreview ? (
              plainExcerpt(chat.lastMessagePreview, { max: 180 })
            ) : (
              <span className="italic">No messages yet</span>
            )}
          </p>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-xs text-2">
              {!sameName ? chat.characterName : null}
              {!sameName && chat.userMessageCount > 0 ? " · " : null}
              {chat.userMessageCount > 0 ? (
                <span className="tabular-nums">
                  {chat.userMessageCount} {chat.userMessageCount === 1 ? "turn" : "turns"}
                </span>
              ) : null}
            </p>

            <Link
              to="/characters/$id"
              params={{ id: chat.characterId }}
              aria-label={`View ${chat.characterName}`}
              className="focus-ring relative z-10 -my-2 inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 -mr-2 text-xs text-2 transition-colors hover:text-brand"
            >
              View character
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}
