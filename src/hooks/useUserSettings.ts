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
    retry: 1,
  });
}

type UpdateUserSettingsInput = {
  defaultProviderId?: string | null;
  defaultPresetId?: string | null;
  defaultSelectedModel?: string | null;
  defaultPersonaId?: string | null;
  systemPrompt?: string | null;
  postHistoryInstructions?: string | null;
  impersonationPrompt?: string | null;
};

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["settings", "user"],
    mutationFn: (input: UpdateUserSettingsInput): Promise<UserSettingsView> =>
      updateUserSettings({ data: input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: userSettingsKeys.current() });
      const previous = queryClient.getQueryData<UserSettingsView>(userSettingsKeys.current());
      if (previous) {
        const patch = Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== undefined),
        ) as Partial<UserSettingsView>;
        queryClient.setQueryData<UserSettingsView>(userSettingsKeys.current(), {
          ...previous,
          ...patch,
        });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(userSettingsKeys.current(), context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(userSettingsKeys.current(), data);
      void queryClient.invalidateQueries({ queryKey: ["chatConfig"] });
    },
  });
}
