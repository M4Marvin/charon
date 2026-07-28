import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGlobalAiConfig, updateGlobalAiConfig } from "@/server/fns/admin";

export const globalAiConfigKeys = {
  all: ["globalAiConfig"] as const,
};

export function useGlobalAiConfig() {
  return useQuery({
    queryKey: globalAiConfigKeys.all,
    queryFn: () => getGlobalAiConfig(),
  });
}

export function useUpdateGlobalAiConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { baseUrl: string; apiKey: string; defaultModel?: string }) =>
      updateGlobalAiConfig({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: globalAiConfigKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["chatConfig"] });
    },
  });
}
