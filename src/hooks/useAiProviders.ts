import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAiProvider,
  deleteAiProvider,
  getAiProvider,
  listAiProviders,
  updateAiProvider,
  type AiProviderListItem,
} from "@/server/fns/aiProviders";
import {
  testProviderConnection,
  testProviderChat,
  type ProbeResult,
  type ChatTestResult,
} from "@/server/fns/models";

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
      void queryClient.invalidateQueries({ queryKey: ["chatConfig"] });
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
      void queryClient.invalidateQueries({ queryKey: ["chatConfig"] });
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
      void queryClient.invalidateQueries({ queryKey: ["chatConfig"] });
    },
  });
}

export function useTestProviderConnection() {
  return useMutation({
    mutationFn: (id: string): Promise<ProbeResult> => testProviderConnection({ data: { id } }),
  });
}

export function useTestProviderChat() {
  return useMutation({
    mutationFn: (input: {
      providerId: string;
      model?: string;
      message?: string;
    }): Promise<ChatTestResult> => testProviderChat({ data: input }),
  });
}

export type { AiProviderListItem };
