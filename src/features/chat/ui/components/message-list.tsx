import { useCallback, useEffect, useRef, useState } from "react";

import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@/components/ui/message-scroller";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { ChevronUp, ChevronDown, MessageCircle } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { MessageOverviewRail } from "./message-overview-rail";
import { supportsScrollDrivenAnimations } from "@/lib/css-supports";
import type { ActivePathEntry } from "@/features/chat/tree/types";

const SCROLL_EDGE_THRESHOLD = 80;

interface MessageListProps {
  chatId: string;
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
  onEdit: (messageLocalId: number, content: string) => boolean;
  onDelete: (messageLocalId: number) => boolean;
  selectedIds?: number[];
  onToggleSelect?: (messageLocalId: number) => void;
  onProposalApplied?: () => void;
  /** Instant-send overlay: user bubble content, null when absent. */
  pendingUserContent: string | null;
  /** Instant-send overlay: assistant typing-dots bubble. */
  showPendingAssistant: boolean;
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
    <div className="absolute right-4 bottom-4 z-10 flex flex-col gap-1.5 md:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="size-10 rounded-full glass text-2 hover:text-1 disabled:opacity-40"
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
        className="size-10 rounded-full glass text-2 hover:text-1 disabled:opacity-40"
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

/**
 * Lifts the scroller primitive's own edge state up to `MessageList` so the
 * `autoScroll` prop — owned above the provider — can be driven by it. `end`
 * is true when the viewport is more than the edge threshold away from the
 * bottom, which is exactly the "user scrolled up" signal the list used to
 * recompute by hand in `onScroll`.
 */
function ScrollStateBridge({
  onScrolledUpChange,
}: {
  onScrolledUpChange: (scrolledUp: boolean) => void;
}) {
  const { end } = useMessageScrollerScrollable();

  useEffect(() => {
    onScrolledUpChange(end);
  }, [end, onScrolledUpChange]);

  return null;
}

/**
 * Re-arms bottom-following after the user returns to the bottom. Toggling
 * `autoScroll` alone only updates the ref; the mode stays "free-scrolling".
 */
function AutoScrollGate({ scrolledUp }: { scrolledUp: boolean }) {
  const { scrollToEnd } = useMessageScroller();
  const wasScrolledUp = useRef(false);

  useEffect(() => {
    if (wasScrolledUp.current && !scrolledUp) scrollToEnd({ behavior: "auto" });
    wasScrolledUp.current = scrolledUp;
  }, [scrolledUp, scrollToEnd]);

  return null;
}

export function MessageList({
  chatId,
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
  selectedIds = [],
  onToggleSelect,
  onProposalApplied,
  pendingUserContent,
  showPendingAssistant,
}: MessageListProps) {
  // Synthetic overlay entries: stable negative localIds, never sent to the
  // server and never written to the query cache. Rendered inert — they are
  // visual feedback only.
  const pendingUserEntry: ActivePathEntry | null =
    pendingUserContent === null
      ? null
      : {
          message: {
            localId: -1,
            parentLocalId: null,
            children: [],
            selectedChildLocalId: null,
            role: "user",
            content: pendingUserContent,
          },
          siblingIndex: 0,
          siblingTotal: 1,
        };
  const pendingAssistantEntry: ActivePathEntry | null = showPendingAssistant
    ? {
        message: {
          localId: -2,
          parentLocalId: null,
          children: [],
          selectedChildLocalId: null,
          role: "assistant",
          content: "",
        },
        siblingIndex: 0,
        siblingTotal: 1,
      }
    : null;

  const isEmpty =
    entries.length === 0 && pendingUserEntry === null && pendingAssistantEntry === null;
  const isStreamingPlaceholder = activePlaceholderId !== null || pendingAssistantEntry !== null;

  // App-level follow gate: with `autoScroll` pinned on, the primitive re-arms
  // "following bottom" on every scroll event, yanking the viewport back down
  // mid-stream. Disable it while the reader is away from the bottom.
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const hasPendingSend = pendingUserContent !== null;

  const handleScrolledUpChange = useCallback((scrolledUp: boolean) => {
    setUserScrolledUp((prev) => (prev === scrolledUp ? prev : scrolledUp));
  }, []);

  // Sending (or recovering a run) is an intent to read the reply: follow it
  // even if the reader was scrolled up when they hit Send.
  useEffect(() => {
    if (hasPendingSend || activePlaceholderId !== null) setUserScrolledUp(false);
  }, [hasPendingSend, activePlaceholderId]);

  // The top fade ramps with scroll distance instead of toggling, so it never
  // pops in at the first pixel of scroll. Scroll-driven CSS animation owns it
  // where the timeline actually runs (see .chat-top-fade in styles.css); the
  // JS fallback covers browsers without the feature and engines whose
  // timelines construct but never activate.
  const syncTopFade = useCallback((el: HTMLElement) => {
    if (!fadeRef.current) return;
    fadeRef.current.style.opacity = String(Math.min(1, Math.max(0, el.scrollTop / 64)));
  }, []);

  // `CSS.supports` over-reports: some engines build the ScrollTimeline and
  // then never advance it (currentTime stays null while the viewport
  // scrolls). Probe the live animation once; only a timeline with a real
  // current time gets to own the fade.
  useEffect(() => {
    const viewport = viewportRef.current;
    const fade = fadeRef.current;
    if (!viewport || !fade) return;

    const animation =
      typeof fade.getAnimations === "function" ? fade.getAnimations()[0] : undefined;
    const timelineCurrent = (animation?.timeline as ScrollTimeline | undefined)?.currentTime;
    const timelineAlive = supportsScrollDrivenAnimations && timelineCurrent !== null;
    if (timelineAlive) return;

    fade.style.animation = "none";
    const onScroll = () => syncTopFade(viewport);
    onScroll();
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [syncTopFade]);

  const ids = entries.map((e) => String(e.message.localId));

  return (
    <MessageScrollerProvider
      key={chatId}
      autoScroll={!userScrolledUp}
      defaultScrollPosition="last-anchor"
      scrollEdgeThreshold={SCROLL_EDGE_THRESHOLD}
      scrollMargin={12}
    >
      <ScrollStateBridge onScrolledUpChange={handleScrolledUpChange} />
      <MessageScroller className="min-h-0 [timeline-scope:--chat-top]">
        <MessageScrollerViewport
          ref={viewportRef}
          className="px-3 pt-3 md:px-6 [scroll-timeline-name:--chat-top]"
          aria-busy={isStreamingPlaceholder || undefined}
        >
          <MessageScrollerContent
            className="mx-auto max-w-3xl flex-col justify-end gap-3 pb-6 max-md:pb-20 max-md:pr-12"
            aria-relevant="additions text"
          >
            {isEmpty ? (
              <div className="flex min-h-[50vh] flex-1 items-center justify-center px-4">
                <EmptyState
                  icon={MessageCircle}
                  title={characterName}
                  description="Start the story by sending a message."
                />
              </div>
            ) : (
              entries.map((entry) => {
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
                      chatId={chatId}
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
                      selected={selectedIds.includes(entry.message.localId)}
                      onToggleSelect={onToggleSelect}
                      onProposalApplied={onProposalApplied}
                    />
                  </MessageScrollerItem>
                );
              })
            )}
            {pendingUserEntry && (
              <MessageScrollerItem messageId="pending-user" scrollAnchor>
                <ChatMessage
                  chatId={chatId}
                  entry={pendingUserEntry}
                  isStreaming={false}
                  streamingText=""
                  isNewest={pendingAssistantEntry === null}
                  characterName={characterName}
                  userName={userName}
                  avatarSrc={userAvatarSrc}
                  disabled
                  synthetic
                  onSwipe={onSwipe}
                  onRegenerate={onRegenerate}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </MessageScrollerItem>
            )}
            {pendingAssistantEntry && (
              <MessageScrollerItem messageId="pending-assistant">
                <ChatMessage
                  chatId={chatId}
                  entry={pendingAssistantEntry}
                  isStreaming
                  streamingText=""
                  isNewest
                  characterName={characterName}
                  userName={userName}
                  avatarSrc={characterAvatarSrc}
                  disabled
                  synthetic
                  onSwipe={onSwipe}
                  onRegenerate={onRegenerate}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        {pendingUserEntry && (
          <span role="status" className="sr-only">
            Message sent.
          </span>
        )}
        {pendingAssistantEntry && (
          <span role="status" className="sr-only">
            Assistant is responding.
          </span>
        )}
        {/* Content eases into the header as it leaves the scrollport. The
            gradient is eased over 64px and its opacity follows scrollTop, so
            neither the colour nor the reveal has a visible edge. */}
        <div
          ref={fadeRef}
          aria-hidden="true"
          className="chat-top-fade pointer-events-none absolute inset-x-0 top-0 z-[1] h-16 opacity-0"
        />
        <AutoScrollGate scrolledUp={userScrolledUp} />
        <MessageScrollerButton
          direction="end"
          variant="secondary"
          size="icon-sm"
          className="z-10"
        />
        <MessageOverviewRail entries={entries} characterName={characterName} userName={userName} />
        <MessageNavButtons ids={ids} />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
