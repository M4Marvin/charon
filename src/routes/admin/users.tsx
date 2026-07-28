import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Search, Trash2 } from "lucide-react";
import { getSession } from "@/lib/auth.functions";
import { authClient } from "@/lib/auth-client";
import { useUsers, useDeleteUser, type UserListItem } from "@/hooks/useUsers";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/users")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session || session.user.role !== "admin") {
      throw redirect({ to: "/c" });
    }
  },
  component: AdminUsersPage,
});

function formatDate(ts: Date): string {
  const now = new Date();
  const diff = now.getTime() - ts.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDateFull(ts: Date): string {
  return ts.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function AdminUsersPage() {
  const { data: users, isLoading, error } = useUsers();
  const deleteUser = useDeleteUser();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const filtered = useMemo(() => {
    if (!users) return [];
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q),
    );
  }, [users, search]);

  const handleDelete = (id: string) => {
    deleteUser.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("User deleted");
          setDeletingId(null);
        },
        onError: (e) => toast.error(`Delete failed: ${(e as Error).message}`),
      },
    );
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link to="/c">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm">Manage accounts, roles, and access.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, username, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : error ? (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {(error as Error).message ?? "Failed to load users"}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {search.trim() ? "No users match your search." : "No users found."}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Banned</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    hydrated={hydrated}
                    isCurrentUser={u.id === currentUserId}
                    deletingId={deletingId}
                    onDeleteClick={() => setDeletingId(u.id)}
                    onDeleteConfirm={() => handleDelete(u.id)}
                    onDeleteCancel={() => setDeletingId(null)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </main>
  );
}

function UserRow({
  user,
  isCurrentUser,
  hydrated,
  deletingId,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  user: UserListItem;
  isCurrentUser: boolean;
  hydrated: boolean;
  deletingId: string | null;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const initials = user.name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const banReason = user.banned ? (user.banReason ? ` — ${user.banReason}` : "") : "";
  const banExpiry =
    user.banned && user.banExpires ? ` (until ${formatDateFull(new Date(user.banExpires))})` : "";

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm">{user.username}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        <Badge variant={user.role === "admin" ? "default" : "outline"}>{user.role}</Badge>
      </TableCell>
      <TableCell>
        {user.banned ? (
          <Badge variant="destructive" title={`Banned${banReason}${banExpiry}`}>
            Banned
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {hydrated
          ? formatDate(new Date(user.createdAt))
          : formatDateFull(new Date(user.createdAt))}
      </TableCell>
      <TableCell>
        {!isCurrentUser && (
          <AlertDialog
            open={deletingId === user.id}
            onOpenChange={(open) => {
              if (!open) onDeleteCancel();
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={onDeleteClick}
                aria-label={`Delete ${user.name}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete user</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete <span className="font-medium text-foreground">{user.name}</span>{" "}
                  and all their data (characters, chats, lorebooks, personas, presets). This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onDeleteConfirm}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </TableCell>
    </TableRow>
  );
}
