import { useQuery } from "@tanstack/react-query";
import { listProviderModels, type ProviderModel } from "@/server/fns/models";

export const providerModelsKey = (providerId: string) => ["providerModels", providerId] as const;

export function useProviderModels(providerId: string) {
  return useQuery({
    queryKey: providerModelsKey(providerId),
    queryFn: () => listProviderModels({ data: { id: providerId } }),
    enabled: providerId.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });
}

export type { ProviderModel };
