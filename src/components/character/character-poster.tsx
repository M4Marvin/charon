import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins, Maximize2, MessageCircle, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { StatChip } from "@/components/common/StatChip";
import { RelativeTime } from "@/components/common/RelativeTime";
import type { CharacterDetail } from "@/db/repositories/characters";
import type { ChatWithCharacter } from "@/db/repositories/chats.js";
import { withImageVersion } from "@/lib/image-optimization";
import { tokenBreakdown } from "@/routes/characters/detail-helpers";

interface CharacterPosterProps {
  character: CharacterDetail;
  chats: ChatWithCharacter[];
  onStartChat: () => void;
  starting: boolean;
}

export function CharacterPoster({ character, chats, onStartChat, starting }: CharacterPosterProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const avatarUrl = character.imagePath
    ? withImageVersion(`/api/characters/${character.id}/avatar`, character.imagePath)
    : null;

  return (
    <div className="overflow-hidden rounded-xl border border-subtle bg-surface lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <button
        type="button"
        aria-label="Expand portrait"
        onClick={() => setLightboxOpen(true)}
        className="focus-ring relative block w-full lg:min-h-0 lg:flex-1 lg:overflow-hidden"
      >
        <div className="relative lg:h-full">
          {avatarUrl ? (
            <OptimizedImage
              key={avatarUrl}
              src={avatarUrl}
              alt={character.name}
              preset="portrait"
              priority
              className="aspect-[3/4] w-full object-cover lg:h-full lg:object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div
            className={
              avatarUrl
                ? "hidden flex aspect-[3/4] w-full items-center justify-center bg-raised lg:h-full"
                : "flex aspect-[3/4] w-full items-center justify-center bg-raised lg:h-full"
            }
          >
            <span className="font-heading text-6xl text-3">{character.name.charAt(0)}</span>
          </div>

          {character.chatCount > 0 ? (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-base/70 px-2 py-0.5 text-[10px] text-1 backdrop-blur">
              <MessagesSquare className="size-3" />
              {character.chatCount}
            </span>
          ) : null}

          <span
            aria-hidden
            className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-full bg-base/60 backdrop-blur"
          >
            <Maximize2 className="size-3.5 text-1" />
          </span>
        </div>
      </button>

      <div className="space-y-4 p-4 lg:shrink-0">
        <Button className="w-full" onClick={onStartChat} disabled={starting}>
          <MessageCircle className="size-4" data-icon="inline-start" />
          Chat with {character.name}
        </Button>

        {chats[0] ? (
          <Button asChild variant="secondary" className="w-full">
            <Link to="/chat/$id" params={{ id: chats[0].id }}>
              Continue chat
            </Link>
          </Button>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border border-subtle bg-raised px-2.5 py-1">
            <StatChip
              icon={MessagesSquare}
              value={character.chatCount}
              label={character.chatCount === 1 ? "chat" : "chats"}
            />
          </span>
          <span className="inline-flex items-center rounded-full border border-subtle bg-raised px-2.5 py-1">
            <StatChip
              icon={MessageCircle}
              value={character.userMessageCount}
              label={character.userMessageCount === 1 ? "turn" : "turns"}
            />
          </span>
          <span className="inline-flex items-center rounded-full border border-subtle bg-raised px-2.5 py-1">
            <StatChip
              icon={Coins}
              value={tokenBreakdown(character.data).total.toLocaleString()}
              label="tokens"
            />
          </span>
        </div>

        {chats.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-2 text-sm font-medium">Recent chats</h2>
            <div className="space-y-1">
              {chats.slice(0, 5).map((chat) => (
                <Link
                  key={chat.id}
                  to="/chat/$id"
                  params={{ id: chat.id }}
                  className="focus-ring -mx-3 flex items-center gap-3 rounded-xl px-3 py-2.5 no-underline motion-safe:transition-colors hover:bg-raised"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-headline truncate">{chat.title}</p>
                    {chat.lastMessagePreview ? (
                      <p className="text-2 line-clamp-1 text-sm">{chat.lastMessagePreview}</p>
                    ) : (
                      <p className="text-2 text-sm italic">No messages yet</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-2 text-xs tabular-nums">
                      <RelativeTime date={chat.updatedAt} />
                    </span>
                    {chat.userMessageCount > 0 ? (
                      <p className="text-2 text-xs tabular-nums">{chat.userMessageCount} turns</p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <PortraitLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        avatarUrl={avatarUrl}
        name={character.name}
      />
    </div>
  );
}

function PortraitLightbox({
  open,
  onOpenChange,
  avatarUrl,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatarUrl: string | null;
  name: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">Portrait of {name}</DialogTitle>
        {avatarUrl ? (
          <OptimizedImage
            key={avatarUrl}
            src={avatarUrl}
            alt={name}
            preset="lightbox"
            intrinsicSize={false}
            priority={open}
            className="mx-auto max-h-[85vh] w-auto rounded-lg"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div
          className={
            avatarUrl
              ? "hidden mx-auto flex aspect-[3/4] w-1/2 max-w-sm items-center justify-center rounded-lg bg-raised"
              : "mx-auto flex aspect-[3/4] w-1/2 max-w-sm items-center justify-center rounded-lg bg-raised"
          }
        >
          <span className="font-heading text-6xl text-3">{name.charAt(0)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
