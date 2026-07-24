import { Calendar, MessageCircle, MessageSquareText, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CharacterDetail } from "@/db/repositories/characters";

export function CharacterHero({ character }: { character: CharacterDetail }) {
  const data = character.data;
  const hasAvatar = Boolean(character.imagePath);
  const tagline = character.tagline || firstLine(data.description, 120);

  return (
    <div className="flex flex-col sm:flex-row gap-6">
      <div className="shrink-0">
        {hasAvatar ? (
          <img
            src={`/${character.imagePath}`}
            alt={character.name}
            className="w-60 sm:w-60 rounded-xl object-cover aspect-3/4 shadow-lg border border-border"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div
          className={`${hasAvatar ? "hidden" : ""} w-60 aspect-3/4 rounded-xl bg-muted flex items-center justify-center shadow-lg border border-border`}
        >
          <User className="size-12 text-muted-foreground/40" />
        </div>
      </div>

      <div className="flex flex-col min-w-0 justify-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{character.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {data.creator ? (
              <span className="flex items-center gap-1">
                <User className="size-3.5" />
                {data.creator}
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <Badge variant="secondary" className="text-xs font-normal">
                {character.spec}
              </Badge>
            </span>
            <span className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs font-normal">
                v{character.specVersion}
              </Badge>
            </span>
            {data.character_version ? (
              <Badge variant="outline" className="text-xs font-normal">
                card v{data.character_version}
              </Badge>
            ) : null}
          </div>
        </div>

        {tagline ? (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{tagline}</p>
        ) : null}

        {data.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {data.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[11px] font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageCircle className="size-3.5" />
            {character.chatCount} {character.chatCount === 1 ? "chat" : "chats"}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquareText className="size-3.5" />
            {character.totalMessageCount}{" "}
            {character.totalMessageCount === 1 ? "message" : "messages"}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="size-3.5" />
            Updated {formatDateShort(character.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

function firstLine(text: string, maxLen: number): string {
  if (!text) return "";
  const firstLine = text.split("\n")[0]?.trim() || "";
  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.slice(0, maxLen) + "…";
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
