import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
  useMessageScrollerVisibility,
} from "@/components/ui/message-scroller";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react";
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

function MessageNavButtons({ ids }: { ids: string[] }) {
  const { scrollToMessage } = useMessageScroller();
  const { visibleMessageIds } = useMessageScrollerVisibility();

  const mid = Math.floor(visibleMessageIds.length / 2);
  const currentIdx = visibleMessageIds[mid] ? ids.indexOf(visibleMessageIds[mid]) : -1;
  const canPrev = currentIdx > 0;
  const canNext = currentIdx >= 0 && currentIdx < ids.length - 1;

  if (ids.length < 2) return null;

  return (
    <div className="absolute bottom-24 right-4 z-10 flex flex-col gap-1.5">
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-full glass text-white/40 hover:text-white/90 disabled:opacity-20"
        disabled={!canPrev}
        onClick={() =>
          scrollToMessage(ids[currentIdx - 1], {
            align: "end",
            behavior: "smooth",
          })
        }
        aria-label="Previous message"
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-full glass text-white/40 hover:text-white/90 disabled:opacity-20"
        disabled={!canNext}
        onClick={() =>
          scrollToMessage(ids[currentIdx + 1], {
            align: "start",
            behavior: "smooth",
          })
        }
        aria-label="Next message"
      >
        <ChevronDown className="size-4" />
      </Button>
    </div>
  );
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
          <p className="font-heading text-xl text-(--sea-ink) mb-2">{characterName}</p>
          <p className="text-sm text-(--sea-ink-soft) leading-relaxed">
            Start the story by sending a message.
          </p>
        </div>
      </div>
    );
  }

  const ids = entries.map((e) => String(e.message.localId));

  return (
    <MessageScrollerProvider
      autoScroll
      defaultScrollPosition="last-anchor"
      scrollEdgeThreshold={80}
    >
      <MessageScroller className="size-full">
        <MessageScrollerViewport className="px-3 md:px-6 pt-20 pb-24">
          <MessageScrollerContent className="mx-auto max-w-3xl flex flex-col gap-3 pb-6">
            {entries.map((entry) => {
              const isPlaceholder =
                activePlaceholderId !== null && entry.message.localId === activePlaceholderId;
              const isUserMessage = entry.message.role === "user";

              return (
                <MessageScrollerItem
                  key={entry.message.localId}
                  messageId={String(entry.message.localId)}
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
        <MessageNavButtons ids={ids} />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
