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
}: ChatHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-xl px-3 py-1 md:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="size-7 rounded-full glass shrink-0 text-white/80 hover:text-white"
        onClick={onBack}
        aria-label="Back to chats"
      >
        <ArrowLeft className="size-3.5" />
      </Button>

      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="size-7 shrink-0">
          <AvatarImage src={avatarSrc ?? undefined} alt={characterName} className="object-cover" />
          <AvatarFallback className="rounded-lg bg-white/10 text-sm text-lagoon">
            {characterName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-heading text-[--sea-ink] text-xs md:text-sm leading-5 truncate">
            {characterName}
          </p>
        </div>
        {isGenerating && (
          <span className="flex items-center gap-0.5 ml-0.5">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-1 rounded-full bg-[--lagoon] animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-7 rounded-full glass shrink-0 text-white/70 hover:text-white hidden lg:inline-flex",
            portraitOpen && "text-[--lagoon] ring-1 ring-[--lagoon]/30",
          )}
          onClick={onTogglePortrait}
          aria-label="Toggle character portrait"
        >
          <User className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-7 rounded-full glass shrink-0 text-white/70 hover:text-white hidden lg:inline-flex",
            sceneOpen && "text-[--lagoon] ring-1 ring-[--lagoon]/30",
          )}
          onClick={onToggleScene}
          aria-label="Toggle scene panel"
        >
          <ImageIcon className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-full glass shrink-0 text-white/80 hover:text-white"
          onClick={onOpenSettings}
          aria-label="Open settings"
        >
          <Settings className="size-3.5" />
        </Button>
      </div>
    </header>
  );
}
