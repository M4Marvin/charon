import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { Shield, Search } from "lucide-react";
import { getSession } from "@/lib/auth.functions";
import { authClient } from "@/lib/auth-client";
import { useUsers, useDeleteUser, useSetUserRole, useBanUser, useUnbanUser, type UserListItem } from "@/hooks/useUsers";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { RelativeTime } from "@/components/common/RelativeTime";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/admin/users")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session || session.user.role !== "admin") throw redirect({ to: "/c" });
  },
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { data: users, isLoading, error } = useUsers();
  const deleteUser = useDeleteUser();
  const setRole = useSetUserRole();
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const { data: session } = authClient.useSession();
  const myId = session?.user?.id;
  const [search, setSearch] = useState("");
  const [delId, setDelId] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<UserListItem | null>(null);
  const [banReason, setBanReason] = useState("");

  const filtered = useMemo(() => {
    if (!users) return [];
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
  }, [users, search]);

  const roleFilter = ["all", "admin", "user", "banned"] as const;
  const [role, setRoleF] = useState<(typeof roleFilter)[number]>("all");
  const shown = role === "all" ? filtered : role === "banned" ? filtered.filter((u) => u.banned) : filtered.filter((u) => u.role === role);

  if (isLoading) return (<main className="mx-auto max-w-[1200px] px-4 py-8"><PageHeader title="Users" /><div className="space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div></main>);
  if (error) return (<main className="mx-auto max-w-[1200px] px-4 py-8"><PageHeader title="Users" /><ErrorBanner message={(error as Error).message ?? "Failed to load users"} /></main>);

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <PageHeader title="Users" subtitle="Manage accounts, roles, and access." />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, username, or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="inline-flex rounded-md border">
          {roleFilter.map((f) => <button key={f} type="button" onClick={() => setRoleF(f)} className={`px-3 py-1.5 text-xs capitalize ${role === f ? "bg-brand/20 text-brand-strong font-medium" : "text-2 hover:text-1"}`}>{f}</button>)}
        </div>
      </div>

      {!users || users.length === 0 ? (
        <EmptyState icon={Shield} title="No users found" />
      ) : shown.length === 0 ? (
        <p className="py-12 text-center text-2 text-sm">No users match your query.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Username</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Banned</TableHead><TableHead>Created</TableHead><TableHead className="w-0" />
              </TableRow></TableHeader>
              <TableBody>
                {shown.map((u) => <DesktopRow key={u.id} user={u} myId={myId} onDelete={() => setDelId(u.id)} onRoleToggle={() => setRole.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" })} onBan={() => { setBanTarget(u); setBanReason(""); }} onUnban={() => unbanUser.mutate({ userId: u.id })} />)}
              </TableBody>
            </Table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {shown.map((u) => (
              <div key={u.id} className="rounded-lg border p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-2 text-xs">{u.username}</p>
                  <div className="flex gap-1 mt-1">
                    <Badge variant={u.role === "admin" ? "default" : "outline"} className="text-[10px]">{u.role}</Badge>
                    {u.banned ? <Badge variant="destructive" className="text-[10px]">Banned</Badge> : null}
                  </div>
                </div>
                {u.id !== myId ? (
                  <RowActionsMenu label={`Actions for ${u.name}`} items={[
                    { label: u.role === "admin" ? "Remove admin" : "Make admin", onSelect: () => setRole.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" }) },
                    ...(u.banned ? [{ label: "Unban", onSelect: () => unbanUser.mutate({ userId: u.id }) }] : [{ label: "Ban", destructive: true, onSelect: () => { setBanTarget(u); setBanReason(""); } }]),
                    { label: "Delete", destructive: true, onSelect: () => setDelId(u.id) },
                  ]} />
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog open={delId !== null} onOpenChange={(o) => !o && setDelId(null)} title="Delete user" description={<span>This will delete all their data. <strong>This action cannot be undone.</strong></span>} destructive loading={deleteUser.isPending}
        onConfirm={() => { if (!delId) return; deleteUser.mutate({ id: delId }, { onSuccess: () => { toast.success("User deleted"); setDelId(null); }, onError: (err) => toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`) }); }} />

      <ConfirmDialog open={banTarget !== null} onOpenChange={(o) => !o && setBanTarget(null)} title={`Ban ${banTarget?.name ?? "user"}`}
        description={<div className="space-y-2"><p>This will prevent the user from signing in.</p><Input placeholder="Reason (optional)" value={banReason} onChange={(e) => setBanReason(e.target.value)} /></div>}
        confirmLabel="Ban" destructive loading={banUser.isPending}
        onConfirm={() => { if (!banTarget) return; banUser.mutate({ userId: banTarget.id, reason: banReason || undefined }, { onSuccess: () => { toast.success("User banned"); setBanTarget(null); }, onError: (err) => toast.error(`Ban failed: ${err instanceof Error ? err.message : String(err)}`) }); }} />
    </main>
  );
}

function DesktopRow({ user, myId, onDelete, onRoleToggle, onBan, onUnban }: { user: UserListItem; myId?: string; onDelete: () => void; onRoleToggle: () => void; onBan: () => void; onUnban: () => void }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{user.name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase()}</div>
          <div className="min-w-0"><div className="truncate text-sm font-medium">{user.name}</div><div className="truncate text-xs text-2">{user.email}</div></div>
        </div>
      </TableCell>
      <TableCell className="text-sm">{user.username}</TableCell>
      <TableCell className="text-sm text-2">{user.email}</TableCell>
      <TableCell><Badge variant={user.role === "admin" ? "default" : "outline"}>{user.role}</Badge></TableCell>
      <TableCell>{user.banned ? <Badge variant="destructive">Banned</Badge> : <span className="text-3 text-xs">—</span>}</TableCell>
      <TableCell className="text-sm text-2"><RelativeTime date={user.createdAt} /></TableCell>
      <TableCell>
        {user.id !== myId ? (
          <RowActionsMenu label={`Actions for ${user.name}`} items={[
            { label: user.role === "admin" ? "Remove admin" : "Make admin", onSelect: onRoleToggle },
            ...(user.banned ? [{ label: "Unban", onSelect: onUnban }] : [{ label: "Ban", destructive: true, onSelect: onBan }]),
            { label: "Delete", destructive: true, onSelect: onDelete },
          ]} />
        ) : null}
      </TableCell>
    </TableRow>
  );
}
