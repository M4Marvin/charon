import type { RefObject } from "react";
import { ArrowLeft, Settings, User, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  characterName: string;
  avatarSrc: string | null;
  isGenerating: boolean;
  onBack: () => void;
  portraitOpen: boolean;
  sceneOpen: boolean;
  onTogglePortrait: () => void;
  onToggleScene: () => void;
  onOpenSettings: () => void;
  settingsButtonRef?: RefObject<HTMLButtonElement | null>;
}

export function ChatHeader({
  characterName,
  avatarSrc,
  isGenerating,
  onBack,
  portraitOpen,
  sceneOpen,
  onTogglePortrait,
  onToggleScene,
  onOpenSettings,
  settingsButtonRef,
}: ChatHeaderProps) {
  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center justify-between border-b border-subtle bg-(--header-bg) px-3 backdrop-blur-xl md:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="size-10 rounded-full glass shrink-0 text-2 hover:text-1"
        onClick={onBack}
        aria-label="Back to chats"
      >
        <ArrowLeft className="size-4" />
      </Button>

      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-7 shrink-0" aria-hidden="true">
          <AvatarImage src={avatarSrc ?? undefined} alt="" className="object-cover" />
          <AvatarFallback className="rounded-full text-brand">
            {characterName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="font-heading text-1 text-xs leading-5 truncate md:text-sm">
            {characterName}
          </h1>
        </div>
        {/* Fixed-width slot: the dots never reflow the name. */}
        <span className="flex w-4 shrink-0 items-center gap-0.5" aria-hidden="true">
          {isGenerating &&
            [0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-1 rounded-full bg-(--lagoon) motion-safe:animate-bounce motion-reduce:animate-none"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "hidden size-10 rounded-full glass shrink-0 text-2 hover:text-1 xl:inline-flex",
            portraitOpen && "text-brand ring-1 ring-brand/30",
          )}
          onClick={onTogglePortrait}
          aria-label="Toggle character portrait"
          aria-expanded={portraitOpen}
          aria-controls="character-portrait-panel"
        >
          <User className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "hidden size-10 rounded-full glass shrink-0 text-2 hover:text-1 xl:inline-flex",
            sceneOpen && "text-brand ring-1 ring-brand/30",
          )}
          onClick={onToggleScene}
          aria-label="Toggle scene panel"
          aria-expanded={sceneOpen}
          aria-controls="custom-image-panel"
        >
          <ImageIcon className="size-4" />
        </Button>
        <Button
          ref={settingsButtonRef}
          variant="ghost"
          size="icon"
          className="size-10 rounded-full glass shrink-0 text-2 hover:text-1"
          onClick={onOpenSettings}
          aria-label="Open settings"
        >
          <Settings className="size-4" />
        </Button>
      </div>
    </header>
  );
}
