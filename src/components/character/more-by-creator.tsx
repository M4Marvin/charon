import { MessagesSquare } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { OptimizedImage } from "@/components/ui/optimized-image";
import type { CharacterCardItem } from "@/db/repositories/characters";
import { withImageVersion } from "@/lib/image-optimization";
import { useCharacterSearch } from "@/hooks/useCharacters";
import { pickMoreByCreator } from "@/routes/characters/detail-helpers";

export function MoreByCreator({ creator, currentId }: { creator: string; currentId: string }) {
  const { data } = useCharacterSearch({ q: creator });
  const items: CharacterCardItem[] = data?.pages.flatMap((page) => page.items) ?? [];
  const more = pickMoreByCreator(items, creator, currentId, 8);

  if (!creator || more.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-title">More by {creator}</h2>
      <div className="flex gap-3 overflow-x-auto no-scrollbar scroll-fade-x pb-1">
        {more.map((item) => {
          const avatarUrl = item.imagePath
            ? withImageVersion(`/api/characters/${item.id}/avatar`, item.imagePath)
            : null;
          return (
            <Link
              key={item.id}
              to="/characters/$id"
              params={{ id: item.id }}
              className="w-28 shrink-0 rounded-lg border border-subtle motion-safe:transition-shadow hover:border-brand/40 hover:shadow-lg focus-ring"
            >
              <div className="aspect-square overflow-hidden rounded-t-lg bg-muted">
                {avatarUrl ? (
                  <OptimizedImage
                    key={avatarUrl}
                    src={avatarUrl}
                    alt={item.name}
                    width={112}
                    height={112}
                    preset="thumbnail"
                    quality={70}
                    className="size-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <div
                  className={`flex aspect-square w-full items-center justify-center bg-raised${
                    avatarUrl ? " hidden" : ""
                  }`}
                >
                  <span className="font-heading text-2xl text-3">{item.name.charAt(0)}</span>
                </div>
              </div>
              <div className="p-2">
                <h3 className="truncate text-xs font-medium text-1">{item.name}</h3>
                <p className="flex items-center gap-1 text-xs text-2 tabular-nums">
                  <MessagesSquare className="size-3" />
                  {item.chatCount}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
