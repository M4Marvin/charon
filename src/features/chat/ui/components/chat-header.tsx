import { ArrowLeft, Settings, User, Image as ImageIcon, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  characterName: string;
  avatarSrc: string | null;
  model?: string | null;
  isGenerating: boolean;
  onBack: () => void;
  portraitOpen: boolean;
  sceneOpen: boolean;
  onTogglePortrait: () => void;
  onToggleScene: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
}

export function ChatHeader({
  characterName,
  avatarSrc,
  model,
  isGenerating,
  onBack,
  portraitOpen,
  sceneOpen,
  onTogglePortrait,
  onToggleScene,
  onOpenSettings,
  onOpenShortcuts,
}: ChatHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-xl px-3 py-2 md:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="size-9 rounded-full glass shrink-0 text-white/80 hover:text-white"
        onClick={onBack}
        aria-label="Back to chats"
      >
        <ArrowLeft className="size-5" />
      </Button>

      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="size-8 shrink-0">
          <AvatarImage
            src={avatarSrc ? `/${avatarSrc}` : undefined}
            alt={characterName}
            className="object-cover"
          />
          <AvatarFallback className="rounded-lg bg-white/10 text-sm text-lagoon">
            {characterName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-heading text-[--sea-ink] text-sm md:text-base leading-5 truncate">
            {characterName}
          </p>
          <p className="text-[11px] md:text-xs leading-4 text-[--sea-ink-soft] truncate">
            {isGenerating
              ? "replying..."
              : model ?? ""}
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
            "size-9 rounded-full glass shrink-0 text-white/70 hover:text-white hidden lg:inline-flex",
            portraitOpen && "text-[--lagoon] ring-1 ring-[--lagoon]/30",
          )}
          onClick={onTogglePortrait}
          aria-label="Toggle character portrait"
        >
          <User className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-9 rounded-full glass shrink-0 text-white/70 hover:text-white hidden lg:inline-flex",
            sceneOpen && "text-[--lagoon] ring-1 ring-[--lagoon]/30",
          )}
          onClick={onToggleScene}
          aria-label="Toggle scene panel"
        >
          <ImageIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full glass shrink-0 text-white/80 hover:text-white"
          onClick={onOpenSettings}
          aria-label="Open settings"
        >
          <Settings className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full glass shrink-0 text-white/80 hover:text-white"
          onClick={onOpenShortcuts}
          aria-label="Keyboard shortcuts"
        >
          <Keyboard className="size-4" />
        </Button>
      </div>
    </header>
  );
}
