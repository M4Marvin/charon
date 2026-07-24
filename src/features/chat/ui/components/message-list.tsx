import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import { ChatMessage } from "./chat-message";
import type { ActivePathEntry } from "@/features/chat/tree/types";

interface MessageListProps {
  entries: ActivePathEntry[];
  activePlaceholderId: number | null;
  streamingText: string;
  characterName: string;
  userName: string;
  characterAvatarSrc: string | null;
  userAvatarSrc: string | null;
  disabled: boolean;
  onSwipe: (messageLocalId: number, direction: "next" | "prev") => void;
  onRegenerate: (messageLocalId: number) => void;
  onEdit: (messageLocalId: number, content: string) => void;
  onDelete: (messageLocalId: number) => void;
}

export function MessageList({
  entries,
  activePlaceholderId,
  streamingText,
  characterName,
  userName,
  characterAvatarSrc,
  userAvatarSrc,
  disabled,
  onSwipe,
  onRegenerate,
  onEdit,
  onDelete,
}: MessageListProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 pt-32">
        <div className="glass rounded-2xl px-8 py-10 text-center max-w-xs">
          <p className="font-heading text-xl text-[--sea-ink] mb-2">
            {characterName}
          </p>
          <p className="text-sm text-[--sea-ink-soft] leading-relaxed">
            Start the story by sending a message.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MessageScrollerProvider
      autoScroll
      defaultScrollPosition="last-anchor"
      scrollEdgeThreshold={80}
    >
      <MessageScroller className="size-full">
        <MessageScrollerViewport className="px-3 md:px-6 pt-28 pb-52">
          <MessageScrollerContent className="mx-auto max-w-3xl flex flex-col gap-10 pb-6">
            {entries.map((entry) => {
              const isPlaceholder =
                activePlaceholderId !== null &&
                entry.message.localId === activePlaceholderId;
              const isUserMessage = entry.message.role === "user";

              return (
                <MessageScrollerItem
                  key={entry.message.localId}
                  scrollAnchor={isUserMessage}
                >
                  <ChatMessage
                    entry={entry}
                    isStreaming={isPlaceholder}
                    streamingText={isPlaceholder ? streamingText : ""}
                    isNewest={entry === entries[entries.length - 1]}
                    characterName={characterName}
                    userName={userName}
                    avatarSrc={
                      entry.message.role === "assistant"
                        ? characterAvatarSrc
                        : entry.message.role === "user"
                          ? userAvatarSrc
                          : null
                    }
                    disabled={disabled}
                    onSwipe={onSwipe}
                    onRegenerate={onRegenerate}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </MessageScrollerItem>
              );
            })}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton
          direction="end"
          variant="secondary"
          size="icon-sm"
          className="bottom-24 z-10"
        />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
