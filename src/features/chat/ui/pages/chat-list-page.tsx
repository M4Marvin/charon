import { Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useChats, useDeleteChat } from "@/hooks/useChats";
import { uploadsUrl } from "@/lib/uploads-url";

export function ChatListPage() {
  const { data: chats, isLoading, error } = useChats();
  const deleteChat = useDeleteChat();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-[--sea-ink-soft]">
          <span className="size-2 rounded-full bg-[--lagoon] animate-bounce" />
          <span className="size-2 rounded-full bg-[--lagoon] animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="size-2 rounded-full bg-[--lagoon] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-400">Failed to load chats.</p>
      </div>
    );
  }

  const items = chats ?? [];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-heading text-2xl text-[--sea-ink]">Chats</h1>
          <Button asChild className="gap-1.5" size="sm">
            <Link to="/c/new">
              <Plus className="size-4" />
              New Chat
            </Link>
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="glass rounded-2xl px-8 py-16 text-center">
            <p className="text-[--sea-ink-soft] mb-4 text-sm">
              No chats yet. Import a character to get started.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link to="/characters">Browse Characters</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((chat) => (
              <div
                key={chat.id}
                className="glass rounded-2xl overflow-hidden group transition-colors hover:bg-white/5"
              >
                <Link
                  to="/c/$id"
                  params={{ id: chat.id }}
                  className="block p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="size-12 shrink-0 rounded-xl ring-1 ring-white/10">
                      <AvatarImage
                        src={uploadsUrl(chat.characterImagePath) ?? undefined}
                        alt={chat.characterName}
                        className="object-cover"
                      />
                      <AvatarFallback className="rounded-xl bg-[--lagoon]/20 text-[--lagoon] text-lg">
                        {chat.characterName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-heading text-sm text-[--sea-ink] truncate">
                        {chat.title}
                      </p>
                      <p className="text-[11px] text-[--sea-ink-soft] truncate">
                        {chat.characterName}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-white/30 tabular-nums">
                    {new Date(chat.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </Link>
                <div className="px-4 pb-3 pt-0 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-white/30 hover:text-red-400"
                    onClick={(e) => {
                      e.preventDefault();
                      if (window.confirm("Delete this chat?")) {
                        deleteChat.mutate({ id: chat.id });
                      }
                    }}
                    aria-label="Delete chat"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
