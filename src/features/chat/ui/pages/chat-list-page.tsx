import { useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Search, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { SkeletonRows } from "@/components/common/Skeletons";
import { RelativeTime } from "@/components/common/RelativeTime";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useChats, useDeleteChat, useRenameChat } from "@/hooks/useChats";

function dayGroup(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  if (d >= today) return "Today";
  if (d >= yesterday) return "Yesterday";
  if (d >= weekAgo) return "Previous 7 days";
  return "Older";
}

export function ChatListPage() {
  const { data: chats, isLoading, error } = useChats();
  const deleteChat = useDeleteChat();
  const renameChat = useRenameChat();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingChat, setRenamingChat] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const filtered = useMemo(() => {
    if (!chats) return [];
    if (!search.trim()) return chats;
    const q = search.toLowerCase();
    return chats.filter(
      (c) => c.title.toLowerCase().includes(q) || c.characterName.toLowerCase().includes(q),
    );
  }, [chats, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const chat of filtered) {
      const k = dayGroup(chat.updatedAt);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(chat);
    }
    return groups;
  }, [filtered]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="Chats" />
        <SkeletonRows rows={6} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        <PageHeader title="Chats" />
        <ErrorBanner message={(error as Error).message ?? "Failed to load chats"} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <PageHeader
        title="Chats"
        actions={
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/c/new">
              <Plus className="size-4" />
              New Chat
            </Link>
          </Button>
        }
      />

      {filtered.length === 0 && !search.trim() ? (
        <EmptyState
          icon={MessageCircle}
          title="No chats yet"
          description="Start a conversation to see it here."
        >
          <Button asChild>
            <Link to="/c/new">Start your first chat</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          {chats && chats.length > 10 ? (
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search chats..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          ) : null}

          {filtered.length === 0 && search.trim() ? (
            <p className="py-12 text-center text-2 text-sm">No chats match your search.</p>
          ) : (
            <div className="space-y-8">
              {["Today", "Yesterday", "Previous 7 days", "Older"].map((day) => {
                const items = grouped.get(day);
                if (!items || items.length === 0) return null;
                return (
                  <section key={day}>
                    <h3 className="text-2 text-sm font-medium mb-3 sticky top-14 z-10 bg-base/80 backdrop-blur-sm py-1">
                      {day}
                    </h3>
                    <div className="space-y-1">
                      {items.map((chat) => (
                        <div
                          key={chat.id}
                          className="group relative flex items-center gap-3 rounded-xl px-3 py-3 -mx-3 hover:bg-surface transition-colors min-h-16"
                        >
                          <Link
                            to="/c/$id"
                            params={{ id: chat.id }}
                            className="flex items-center gap-3 flex-1 min-w-0 focus-ring rounded-xl no-underline"
                          >
                            <Avatar className="size-12 shrink-0 rounded-xl">
                              <AvatarImage
                                src={
                                  chat.characterImagePath
                                    ? `/api/characters/${chat.characterId}/avatar`
                                    : undefined
                                }
                                alt={chat.characterName}
                                className="object-cover"
                              />
                              <AvatarFallback className="rounded-xl bg-brand/20 text-brand text-lg">
                                {chat.characterName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="text-headline truncate">{chat.title}</p>
                                <span className="text-3 text-xs shrink-0 tabular-nums">
                                  <RelativeTime date={chat.updatedAt} />
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-2 text-sm truncate">{chat.characterName}</p>
                                {chat.userMessageCount > 0 && (
                                  <span className="text-3 text-xs tabular-nums shrink-0">
                                    · {chat.userMessageCount} turns
                                  </span>
                                )}
                              </div>
                              {chat.lastMessagePreview ? (
                                <p className="text-3 text-sm line-clamp-1">
                                  {chat.lastMessagePreview}
                                </p>
                              ) : (
                                <p className="text-3 text-sm italic">No messages yet</p>
                              )}
                            </div>
                          </Link>
                          <RowActionsMenu
                            label={`Actions for ${chat.title}`}
                            items={[
                              {
                                label: "Rename",
                                onSelect: () =>
                                  setRenamingChat({ id: chat.id, title: chat.title }),
                              },
                              {
                                label: "Delete",
                                destructive: true,
                                onSelect: () => setDeletingId(chat.id),
                              },
                            ]}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title="Delete chat"
        description="This will permanently delete the chat and all its messages. This action cannot be undone."
        destructive
        loading={deleteChat.isPending}
        onConfirm={() => {
          if (!deletingId) return;
          deleteChat.mutate(
            { id: deletingId },
            {
              onSuccess: () => {
                toast.success("Chat deleted");
                setDeletingId(null);
              },
              onError: (err) =>
                toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`),
            },
          );
        }}
      />

      <RenameChatDialog
        chat={renamingChat}
        loading={renameChat.isPending}
        onClose={() => setRenamingChat(null)}
        onRename={(id, title) => {
          renameChat.mutate(
            { id, title },
            {
              onSuccess: () => {
                toast.success("Chat renamed");
                setRenamingChat(null);
              },
              onError: (err) =>
                toast.error(`Rename failed: ${err instanceof Error ? err.message : String(err)}`),
            },
          );
        }}
      />
    </main>
  );
}

function RenameChatDialog({
  chat,
  loading,
  onClose,
  onRename,
}: {
  chat: { id: string; title: string } | null;
  loading: boolean;
  onClose: () => void;
  onRename: (id: string, title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!chat) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title cannot be empty.");
      return;
    }
    if (trimmed === chat.title) {
      onClose();
      return;
    }
    setError(null);
    onRename(chat.id, trimmed);
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Chat</DialogTitle>
          <DialogDescription>Enter a new title for this chat.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          onKeyDown={(e) => {
            if (e.key === "Enter") e.stopPropagation();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="rename-title">Title</Label>
            <Input
              id="rename-title"
              defaultValue={chat.title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              disabled={loading}
              autoFocus
              required
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
