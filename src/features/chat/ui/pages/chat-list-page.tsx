import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Search, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { SkeletonRows } from "@/components/common/Skeletons";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useDeleteChat, useRenameChat } from "@/hooks/useChats";
import { useChatList, DAY_GROUPS } from "../hooks/use-chat-list";
import { ChatDayGroup } from "../components/chat-day-group";
import { RenameChatDialog } from "../components/rename-chat-dialog";

export function ChatListPage() {
  const { chats, filtered, grouped, search, setSearch, isLoading, error } = useChatList();
  const deleteChat = useDeleteChat();
  const renameChat = useRenameChat();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingChat, setRenamingChat] = useState<{
    id: string;
    title: string;
  } | null>(null);

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
            <Link to="/characters">
              <Plus className="size-4" /> New Chat
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
            <Link to="/characters">Start your first chat</Link>
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
              {DAY_GROUPS.map((day) => {
                const items = grouped.get(day);
                if (!items || items.length === 0) return null;
                return (
                  <ChatDayGroup
                    key={day}
                    label={day}
                    chats={items}
                    onRename={(id, title) => setRenamingChat({ id, title })}
                    onDelete={(id) => setDeletingId(id)}
                  />
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
