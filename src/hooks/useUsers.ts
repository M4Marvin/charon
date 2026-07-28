import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listUsers, deleteUser, type UserListItem } from "@/server/fns/users";
import { authClient } from "@/lib/auth-client";

export const userKeys = {
  all: ["users"] as const,
  list: () => [...userKeys.all, "list"] as const,
};

export function useUsers() {
  return useQuery({
    queryKey: userKeys.list(),
    queryFn: () => listUsers(),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }): Promise<{ id: string }> => deleteUser({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; role: "admin" | "user" }) => {
      const { error } = await authClient.admin.setRole({ userId: input.userId, role: input.role });
      if (error) throw new Error(error.message ?? "Failed to change role");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

export function useBanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; reason?: string }) => {
      const { error } = await authClient.admin.banUser({
        userId: input.userId,
        banReason: input.reason,
      });
      if (error) throw new Error(error.message ?? "Failed to ban user");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

export function useUnbanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string }) => {
      const { error } = await authClient.admin.unbanUser({ userId: input.userId });
      if (error) throw new Error(error.message ?? "Failed to unban user");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { username: string; password: string; name: string }) => {
      const { error } = await authClient.admin.createUser({
        email: `${input.username}@demo.local`,
        password: input.password,
        name: input.name,
        username: input.username,
      } as any);
      if (error) throw new Error(error.message ?? "Failed to create user");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

export type { UserListItem };
