import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAiProvider,
  deleteAiProvider,
  getAiProvider,
  listAiProviders,
  updateAiProvider,
  type AiProviderListItem,
} from "@/server/fns/aiProviders";

export const aiProviderKeys = {
  all: ["aiProviders"] as const,
  list: () => [...aiProviderKeys.all, "list"] as const,
  detail: (id: string) => [...aiProviderKeys.all, "detail", id] as const,
};

export function useAiProviders() {
  return useQuery({
    queryKey: aiProviderKeys.list(),
    queryFn: () => listAiProviders(),
  });
}

export function useAiProvider(id: string) {
  return useQuery({
    queryKey: aiProviderKeys.detail(id),
    queryFn: () => getAiProvider({ data: { id } }),
    enabled: id.length > 0,
  });
}

export function useCreateAiProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      baseUrl: string;
      apiKey: string;
      defaultModel?: string;
      defaultHeaders?: Record<string, string>;
    }): Promise<{ id: string }> => createAiProvider({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiProviderKeys.all });
    },
  });
}

export function useUpdateAiProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      name?: string;
      baseUrl?: string;
      apiKey?: string;
      defaultModel?: string | null;
      defaultHeaders?: Record<string, string> | null;
    }): Promise<{ id: string }> => updateAiProvider({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: aiProviderKeys.all });
      void queryClient.invalidateQueries({ queryKey: aiProviderKeys.detail(variables.id) });
    },
  });
}

export function useDeleteAiProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }): Promise<{ id: string }> =>
      deleteAiProvider({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: aiProviderKeys.all });
      queryClient.removeQueries({ queryKey: aiProviderKeys.detail(variables.id) });
    },
  });
}

export type { AiProviderListItem };
