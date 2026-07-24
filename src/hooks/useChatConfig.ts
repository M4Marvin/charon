import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getChatConfigFn } from "@/features/chat/config/fns";
import { updateChatSettings } from "@/server/fns/chats";
import { chatKeys } from "@/hooks/useChats";

export const chatConfigKeys = {
  detail: (id: string) => ["chatConfig", id] as const,
};

export function useChatConfig(chatId: string) {
  return useQuery({
    queryKey: chatConfigKeys.detail(chatId),
    queryFn: () => getChatConfigFn({ data: { chatId } }),
    enabled: chatId.length > 0,
  });
}

export function useUpdateChatOverrides() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      characterDescription?: string | null;
      characterPersonality?: string | null;
      characterScenario?: string | null;
      characterSystemPrompt?: string | null;
      backgroundId?: string | null;
    }) => updateChatSettings({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: chatConfigKeys.detail(variables.id) });
    },
  });
}
