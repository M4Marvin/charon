import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  listDevChats,
  listDevCharacters,
  createTestChat,
  getDevChatDetail,
  getDevMessages,
  getDevActivePath,
  devAppendUserAndReply,
  devSwipe,
  devEditMessage,
  devDeleteBranch,
  devAcquireLock,
  devReleaseLock,
} from "@/features/chat/dev-fns";
import type { ChatMessage } from "@/lib/st-core/shared/types";
import type { ChatDetail, ActivePathEntry } from "@/features/chat/tree/types";

export const Route = createFileRoute("/c/dev")({
  component: DevPage,
});

// ── Query keys ──

const QK = {
  chats: ["dev", "chats"] as const,
  characters: ["dev", "characters"] as const,
  chatDetail: (id: string) => ["dev", "chat", id, "detail"] as const,
  messages: (id: string) => ["dev", "chat", id, "messages"] as const,
  activePath: (id: string) => ["dev", "chat", id, "active-path"] as const,
};

// ── Hooks ──

function useDevChats() {
  return useQuery({ queryKey: QK.chats, queryFn: () => listDevChats() });
}

function useDevCharacters() {
  return useQuery({ queryKey: QK.characters, queryFn: () => listDevCharacters() });
}

function useDevChatDetail(chatId: string | null) {
  return useQuery({
    queryKey: QK.chatDetail(chatId ?? "_"),
    queryFn: () => getDevChatDetail({ data: { chatId: chatId! } }),
    enabled: chatId !== null,
  });
}

function useDevMessages(chatId: string | null) {
  return useQuery({
    queryKey: QK.messages(chatId ?? "_"),
    queryFn: () => getDevMessages({ data: { chatId: chatId! } }),
    enabled: chatId !== null,
  });
}

function useDevActivePath(chatId: string | null) {
  return useQuery({
    queryKey: QK.activePath(chatId ?? "_"),
    queryFn: () => getDevActivePath({ data: { chatId: chatId! } }),
    enabled: chatId !== null,
  });
}

// ── Tree rendering helpers ──

type TreeNode = {
  message: ChatMessage;
  children: TreeNode[];
  depth: number;
  isActive: boolean;
  isSelected: boolean;
};

function buildTree(messages: ChatMessage[], activeLocalIds: Set<number>, selectedId: number | null): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  for (const msg of messages) {
    map.set(msg.localId, {
      message: msg,
      children: [],
      depth: 0,
      isActive: activeLocalIds.has(msg.localId),
      isSelected: msg.localId === selectedId,
    });
  }

  for (const msg of messages) {
    const node = map.get(msg.localId)!;
    if (msg.parentLocalId !== null) {
      const parent = map.get(msg.parentLocalId);
      if (parent) {
        parent.children.push(node);
        node.depth = parent.depth + 1;
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function TreeNodeRow({
  node,
  onSelect,
}: {
  node: TreeNode;
  onSelect: (id: number) => void;
}) {
  const indent = node.depth * 20;

  return (
    <>
      <div
        className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-accent/50 text-sm ${
          node.isSelected ? "bg-accent font-medium" : ""
        } ${node.isActive ? "ring-1 ring-amber-400" : ""}`}
        style={{ paddingLeft: `${12 + indent}px` }}
        onClick={() => onSelect(node.message.localId)}
      >
        <span className="font-mono text-xs text-muted-foreground w-6 shrink-0">
          {node.message.localId}
        </span>
        <Badge variant="outline" className="text-[10px] px-1 h-4">
          {node.message.role}
        </Badge>
        <span className="truncate text-xs text-muted-foreground">
          {node.message.content.slice(0, 80)}
          {node.message.content.length > 80 ? "..." : ""}
        </span>
        {node.isActive && (
          <Badge variant="secondary" className="text-[9px] px-1 h-4">
            active
          </Badge>
        )}
        {node.message.selectedChildLocalId !== null && (
          <span className="text-[9px] text-muted-foreground ml-auto">
            ↓{node.message.selectedChildLocalId}
          </span>
        )}
        {node.message.extra && (
          <span className="text-[9px] text-amber-500">extra</span>
        )}
      </div>
      {node.children.map((child) => (
        <TreeNodeRow key={child.message.localId} node={child} onSelect={onSelect} />
      ))}
    </>
  );
}

// ── Tab: Tree ──

function TreeTab({
  messages,
  activePath,
  selectedNodeId,
  onSelectNode,
}: {
  messages: ChatMessage[];
  activePath: ActivePathEntry[] | null;
  selectedNodeId: number | null;
  onSelectNode: (id: number) => void;
}) {
  const activeIds = new Set(activePath?.map((p) => p.message.localId) ?? []);
  const tree = buildTree(messages, activeIds, selectedNodeId);

  return (
    <div className="space-y-4">
      {activePath && activePath.length > 0 && (
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium">Active Path</CardTitle>
          </CardHeader>
          <CardContent className="py-1 px-3">
            {activePath.map((entry) => (
              <div key={entry.message.localId} className="flex items-center gap-2 text-xs py-0.5">
                <span className="font-mono text-muted-foreground w-4">{entry.message.localId}</span>
                <Badge variant="outline" className="text-[10px] px-1 h-4">
                  {entry.message.role}
                </Badge>
                <span className="truncate">{entry.message.content.slice(0, 60)}</span>
                <span className="text-muted-foreground shrink-0">
                  ({entry.siblingIndex + 1}/{entry.siblingTotal})
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium">Message Tree</CardTitle>
        </CardHeader>
        <CardContent className="py-1 px-1">
          <ScrollArea className="max-h-[500px]">
            {tree.map((root) => (
              <TreeNodeRow key={root.message.localId} node={root} onSelect={onSelectNode} />
            ))}
            {tree.length === 0 && (
              <p className="text-xs text-muted-foreground p-4 text-center">No messages</p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab: Operations ──

function OperationsTab({
  chatId,
  selectedNodeId,
}: {
  chatId: string;
  selectedNodeId: number | null;
}) {
  const queryClient = useQueryClient();
  const [userMsg, setUserMsg] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [editContent, setEditContent] = useState("");
  const [swipeDir, setSwipeDir] = useState<"next" | "prev">("next");
  const [lockResult, setLockResult] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: QK.chatDetail(chatId) });
    void queryClient.invalidateQueries({ queryKey: QK.messages(chatId) });
    void queryClient.invalidateQueries({ queryKey: QK.activePath(chatId) });
    void queryClient.invalidateQueries({ queryKey: QK.chats });
  };

  const appendMutation = useMutation({
    mutationFn: () =>
      devAppendUserAndReply({
        data: { chatId, userContent: userMsg || "(empty)", replyContent },
      }),
    onSuccess: () => {
      setUserMsg("");
      setReplyContent("");
      invalidate();
    },
    onError: (err) => setLockResult(`Error: ${err.message}`),
  });

  const swipeMutation = useMutation({
    mutationFn: () =>
      devSwipe({
        data: { chatId, messageLocalId: selectedNodeId!, direction: swipeDir },
      }),
    onSuccess: () => invalidate(),
    onError: (err) => setLockResult(`Error: ${err.message}`),
  });

  const editMutation = useMutation({
    mutationFn: () =>
      devEditMessage({
        data: { chatId, messageLocalId: selectedNodeId!, content: editContent },
      }),
    onSuccess: () => {
      setEditContent("");
      invalidate();
    },
    onError: (err) => setLockResult(`Error: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      devDeleteBranch({
        data: { chatId, messageLocalId: selectedNodeId! },
      }),
    onSuccess: () => invalidate(),
    onError: (err) => setLockResult(`Error: ${err.message}`),
  });

  const acquireLockMutation = useMutation({
    mutationFn: () =>
      devAcquireLock({
        data: { chatId, messageLocalId: selectedNodeId ?? 1 },
      }),
    onSuccess: () => {
      setLockResult("Lock acquired");
      invalidate();
    },
    onError: (err) => setLockResult(`Error: ${err.message}`),
  });

  const releaseLockMutation = useMutation({
    mutationFn: () => devReleaseLock({ data: { chatId } }),
    onSuccess: () => {
      setLockResult("Lock released");
      invalidate();
    },
    onError: (err) => setLockResult(`Error: ${err.message}`),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium">Append User + Reply</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 py-2 px-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">User message</Label>
              <Input
                value={userMsg}
                onChange={(e) => setUserMsg(e.target.value)}
                placeholder="What the user says"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reply content</Label>
              <Input
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Assistant reply"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <Button
            size="sm"
            className="w-full text-xs"
            onClick={() => appendMutation.mutate()}
            disabled={appendMutation.isPending}
          >
            {appendMutation.isPending ? "Appending..." : "Append"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium">Swipe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 py-2 px-3">
          <div className="flex items-center gap-2">
            <select
              value={swipeDir}
              onChange={(e) => setSwipeDir(e.target.value as "next" | "prev")}
              className="h-8 rounded border px-2 text-xs"
            >
              <option value="next">Next</option>
              <option value="prev">Prev</option>
            </select>
            <span className="text-xs text-muted-foreground">
              on node <span className="font-mono">{selectedNodeId ?? "—"}</span>
            </span>
          </div>
          <Button
            size="sm"
            className="w-full text-xs"
            onClick={() => swipeMutation.mutate()}
            disabled={swipeMutation.isPending || selectedNodeId === null}
          >
            {swipeMutation.isPending ? "Swiping..." : "Swipe"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium">Edit Message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 py-2 px-3">
          <div className="space-y-1">
            <Label className="text-xs">
              Node <span className="font-mono">{selectedNodeId ?? "—"}</span> new content
            </Label>
            <Input
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="New content"
              className="h-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            className="w-full text-xs"
            onClick={() => editMutation.mutate()}
            disabled={editMutation.isPending || selectedNodeId === null || !editContent}
          >
            {editMutation.isPending ? "Editing..." : "Edit"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium">Delete Branch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 py-2 px-3">
          <p className="text-xs text-muted-foreground">
            Delete node <span className="font-mono">{selectedNodeId ?? "—"}</span> and all descendants
          </p>
          <Button
            size="sm"
            variant="destructive"
            className="w-full text-xs"
            onClick={() => {
              if (window.confirm(`Delete node ${selectedNodeId} and all its descendants?`)) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending || selectedNodeId === null}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium">Lock Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 py-2 px-3">
          <p className="text-xs text-muted-foreground">
            Acquire lock on node <span className="font-mono">{selectedNodeId ?? 1}</span>
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              onClick={() => acquireLockMutation.mutate()}
              disabled={acquireLockMutation.isPending}
            >
              Acquire Lock
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              onClick={() => releaseLockMutation.mutate()}
              disabled={releaseLockMutation.isPending}
            >
              Release Lock
            </Button>
          </div>
          {lockResult && (
            <p className="text-xs text-muted-foreground mt-1">{lockResult}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab: Raw Data ──

function RawDataTab({
  chatDetail,
  messages,
  activePath,
}: {
  chatDetail: ChatDetail | null;
  messages: ChatMessage[];
  activePath: ActivePathEntry[] | null;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium">Chat Detail</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3">
          <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-48">
            {JSON.stringify(chatDetail, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium">
            Messages ({messages.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3">
          <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-80">
            {JSON.stringify(messages, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium">
            Active Path ({activePath?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3">
          <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-48">
            {JSON.stringify(activePath, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main page ──

function DevPage() {
  const queryClient = useQueryClient();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"tree" | "ops" | "raw">("tree");

  const { data: chats } = useDevChats();
  const { data: characters } = useDevCharacters();
  const { data: chatDetail } = useDevChatDetail(selectedChatId);
  const { data: messages } = useDevMessages(selectedChatId);
  const { data: activePath } = useDevActivePath(selectedChatId);

  const firstChar = characters?.[0] ?? null;

  const createChatMutation = useMutation({
    mutationFn: () =>
      createTestChat({
        data: {
          characterId: firstChar!.id,
          title: `Dev Chat ${new Date().toLocaleTimeString()}`,
        },
      }),
    onSuccess: (chat) => {
      setSelectedChatId(chat.id);
      setSelectedNodeId(null);
      void queryClient.invalidateQueries({ queryKey: QK.chats });
    },
  });

  const selectedChat = chats?.find((c) => c.id === selectedChatId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">🛠 Chat Tree Dev Console</h1>
          <p className="text-xs text-muted-foreground">
            Inspect and exercise the tree + lock modules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: QK.chats });
              void queryClient.invalidateQueries({ queryKey: QK.characters });
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <select
          className="h-8 rounded border px-2 text-xs min-w-[200px]"
          value={selectedChatId ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedChatId(val || null);
            setSelectedNodeId(null);
          }}
        >
          <option value="">— Select a chat —</option>
          {chats?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({c.characterName})
            </option>
          ))}
        </select>

        <Button
          size="sm"
          className="text-xs"
          onClick={() => createChatMutation.mutate()}
          disabled={createChatMutation.isPending || !firstChar}
          title={!firstChar ? "No characters found — create one first in the app" : ""}
        >
          {createChatMutation.isPending ? "Creating..." : "Create Test Chat"}
        </Button>
      </div>

      {selectedChat && (
        <div className="mb-4 flex items-center gap-3">
          <Badge
            variant={selectedChat.lockState === "idle" ? "secondary" : "default"}
            className="text-xs"
          >
            {selectedChat.lockState === "idle" ? "● idle" : "● generating"}
          </Badge>
          {selectedChat.lockMessageLocalId !== null && (
            <span className="text-xs text-muted-foreground">
              streaming into message <span className="font-mono">{selectedChat.lockMessageLocalId}</span>
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Chat: <span className="font-mono">{selectedChat.id}</span>
          </span>
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b">
        {(["tree", "ops", "raw"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "tree" ? "🌲 Tree" : tab === "ops" ? "🔧 Operations" : "📄 Raw"}
          </button>
        ))}
      </div>

      {activeTab === "tree" && selectedChatId && (
        <TreeTab
          messages={messages ?? []}
          activePath={activePath ?? null}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />
      )}

      {activeTab === "ops" && selectedChatId && (
        <OperationsTab
          chatId={selectedChatId}
          selectedNodeId={selectedNodeId}
        />
      )}

      {activeTab === "raw" && selectedChatId && (
        <RawDataTab
          chatDetail={chatDetail ?? null}
          messages={messages ?? []}
          activePath={activePath ?? null}
        />
      )}

      {!selectedChatId && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Select a chat from the dropdown or create a new test chat.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
