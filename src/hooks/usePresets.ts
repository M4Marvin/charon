import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPreset,
  deletePreset,
  getPreset,
  listPresets,
  updatePreset,
  type PresetListItem,
} from "@/server/fns/presets";
import type { PresetData } from "@/db/repositories/presets";
import { userSettingsKeys } from "@/hooks/useUserSettings";

export const presetKeys = {
  all: ["presets"] as const,
  list: () => [...presetKeys.all, "list"] as const,
  detail: (id: string) => [...presetKeys.all, "detail", id] as const,
};

export function usePresets() {
  return useQuery({
    queryKey: presetKeys.list(),
    queryFn: () => listPresets(),
    retry: 1,
  });
}

export function usePreset(id: string) {
  return useQuery({
    queryKey: presetKeys.detail(id),
    queryFn: () => getPreset({ data: { id } }),
    enabled: id.length > 0,
  });
}

export function useCreatePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      providerId?: string;
      model?: string;
      data: PresetData;
    }): Promise<{ id: string }> => createPreset({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: presetKeys.all });
      void queryClient.invalidateQueries({ queryKey: userSettingsKeys.current() });
      void queryClient.invalidateQueries({ queryKey: ["chatConfig"] });
    },
  });
}

export function useUpdatePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      name?: string;
      providerId?: string | null;
      model?: string | null;
      data?: PresetData;
    }): Promise<{ id: string }> => updatePreset({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: presetKeys.all });
      void queryClient.invalidateQueries({ queryKey: presetKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: userSettingsKeys.current() });
      void queryClient.invalidateQueries({ queryKey: ["chatConfig"] });
    },
  });
}

export function useDeletePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }): Promise<{ id: string; wasDefault: boolean }> =>
      deletePreset({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: presetKeys.all });
      queryClient.removeQueries({ queryKey: presetKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: userSettingsKeys.current() });
      void queryClient.invalidateQueries({ queryKey: ["chatConfig"] });
    },
  });
}

export type { PresetListItem, PresetData };
