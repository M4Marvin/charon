import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listBackgrounds,
  getBackground,
  uploadBackground,
  deleteBackground,
  type BackgroundListItem,
} from "@/server/fns/backgrounds";
import type { Background } from "@/db/schema";

const backgroundKeys = {
  all: ["backgrounds"] as const,
  list: () => [...backgroundKeys.all, "list"] as const,
  detail: (id: string) => [...backgroundKeys.all, "detail", id] as const,
};

export function useBackgrounds() {
  return useQuery({
    queryKey: backgroundKeys.list(),
    queryFn: () => listBackgrounds(),
  });
}

export function useBackground(id: string) {
  return useQuery({
    queryKey: backgroundKeys.detail(id),
    queryFn: () => getBackground({ data: { id } }),
    enabled: id.length > 0,
  });
}

export function useUploadBackground() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; fileBase64: string }) => uploadBackground({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backgroundKeys.list() });
    },
  });
}

export function useDeleteBackground() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }) => deleteBackground({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backgroundKeys.list() });
    },
  });
}

export type { BackgroundListItem, Background };
