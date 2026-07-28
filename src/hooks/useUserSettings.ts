import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUserSettings,
  updateUserSettings,
  type UserSettingsView,
} from "@/server/fns/userSettings";

export const userSettingsKeys = {
  all: ["userSettings"] as const,
  current: () => [...userSettingsKeys.all, "current"] as const,
};

export function useUserSettings() {
  return useQuery({
    queryKey: userSettingsKeys.current(),
    queryFn: () => getUserSettings(),
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      defaultProviderId?: string | null;
      defaultPresetId?: string | null;
      defaultSelectedModel?: string | null;
      defaultPersonaId?: string | null;
      systemPrompt?: string | null;
      postHistoryInstructions?: string | null;
      impersonationPrompt?: string | null;
    }): Promise<UserSettingsView> => updateUserSettings({ data: input }),
    onSuccess: (data) => {
      queryClient.setQueryData(userSettingsKeys.current(), data);
      void queryClient.invalidateQueries({ queryKey: ["chatConfig"] });
    },
  });
}
