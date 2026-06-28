import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CharacterListItem } from "@/server/fns/characters";

export function CharacterCard({
  character,
  onDelete,
  isDeleting,
  onTagClick,
  isDemo,
}: {
  character: CharacterListItem;
  onDelete: (id: string, name: string) => void;
  isDeleting: boolean;
  onTagClick?: (tag: string) => void;
  isDemo?: boolean;
}) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate({ to: "/characters/$id", params: { id: character.id } });
  };

  return (
    <Card
      className="overflow-hidden [--card-spacing:0px] cursor-pointer hover:bg-muted/20 transition-colors"
      role="link"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2 p-2 pb-0">
        <h3 className="font-semibold text-sm leading-tight truncate">{character.name}</h3>
        <div className="flex items-center gap-1 text-muted-foreground text-xs shrink-0 leading-tight">
          <MessageCircle className="size-3.5" />
          <span>{character.chatCount}</span>
        </div>
      </div>

      <CardContent className="flex gap-2 p-2">
        {character.imagePath ? (
          <img
            src={`/api/characters/${character.id}/avatar`}
            alt={character.name}
            className="size-20 shrink-0 rounded-md object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="size-20 shrink-0 rounded-md bg-muted" />
        )}
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <p className="text-muted-foreground text-[11px] leading-snug line-clamp-2">
            {character.creatorNotes || "No creator notes"}
          </p>
          {character.tags.length > 0 ? (
            <div className="flex flex-wrap gap-0.5">
              {character.tags.slice(0, 5).map((tag) => (
                <Badge
                  key={tag}
                  asChild
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 leading-tight"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagClick?.(tag);
                    }}
                    className="cursor-pointer hover:bg-secondary/80"
                  >
                    {tag}
                  </button>
                </Badge>
              ))}
              {character.tags.length > 5 ? (
                <span className="text-muted-foreground text-[10px] self-center">
                  +{character.tags.length - 5}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>

      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <div className="flex items-center gap-1.5 min-w-0 text-muted-foreground text-[10px] leading-tight">
          <span className="truncate">{character.creator || "Unknown"}</span>
          <span>·</span>
          <span className="shrink-0">
            {formatDistanceToNow(character.updatedAt, { addSuffix: true })}
          </span>
        </div>
        {!isDemo && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-destructive"
              disabled={isDeleting}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(character.id, character.name);
              }}
              aria-label={`Delete ${character.name}`}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
