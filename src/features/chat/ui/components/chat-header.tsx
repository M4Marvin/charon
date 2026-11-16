import type { RefObject } from "react";
import { ArrowLeft, Check, Ellipsis, Settings, User, Image as ImageIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  characterName: string;
  avatarSrc: string | null;
  isGenerating: boolean;
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
  portraitOpen,
  sceneOpen,
  onTogglePortrait,
  onToggleScene,
  onOpenSettings,
  settingsButtonRef,
}: ChatHeaderProps) {
  return (
    <header className="relative z-30 flex h-12 min-w-0 shrink-0 items-center justify-between border-b border-subtle bg-(--header-bg) px-3 backdrop-blur-xl md:px-5">
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="size-10 rounded-full glass shrink-0 text-2 hover:text-1"
      >
        <Link to="/chat" aria-label="Back to chats">
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
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
                className="size-1 rounded-full bg-brand motion-safe:animate-bounce motion-reduce:animate-none"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {/* Two view toggles cost the character name its width on phones. */}
        <span className="hidden items-center gap-1 xl:flex">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "inline-flex size-10 rounded-full glass shrink-0 text-2 hover:text-1",
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
              "inline-flex size-10 rounded-full glass shrink-0 text-2 hover:text-1",
              sceneOpen && "text-brand ring-1 ring-brand/30",
            )}
            onClick={onToggleScene}
            aria-label="Toggle scene panel"
            aria-expanded={sceneOpen}
            aria-controls="custom-image-panel"
          >
            <ImageIcon className="size-4" />
          </Button>
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="inline-flex size-10 rounded-full glass shrink-0 text-2 hover:text-1 xl:hidden"
              aria-label="View options"
            >
              <Ellipsis className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={onTogglePortrait}>
              <User className="size-4" />
              Character portrait
              {portraitOpen ? <Check className="ml-auto size-4 text-brand" /> : null}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleScene}>
              <ImageIcon className="size-4" />
              Scene image
              {sceneOpen ? <Check className="ml-auto size-4 text-brand" /> : null}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
