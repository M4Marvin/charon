import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getChatConfigFn } from "@/features/chat/config/fns";
import type { ChatConfigClient } from "@/features/chat/config/types";
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

type UpdateChatOverridesInput = {
  id: string;
  characterDescription?: string | null;
  characterPersonality?: string | null;
  characterScenario?: string | null;
  characterSystemPrompt?: string | null;
  backgroundId?: string | null;
};

export function useUpdateChatOverrides() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["settings", "chat"],
    mutationFn: (input: UpdateChatOverridesInput) => updateChatSettings({ data: input }),
    onMutate: async (input) => {
      const key = chatConfigKeys.detail(input.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ChatConfigClient>(key);
      if (previous) {
        const chat = { ...previous.chat };
        if (input.characterDescription !== undefined) {
          chat.characterDescription = input.characterDescription ?? "";
        }
        if (input.characterPersonality !== undefined) {
          chat.characterPersonality = input.characterPersonality ?? "";
        }
        if (input.characterScenario !== undefined) {
          chat.characterScenario = input.characterScenario ?? "";
        }
        if (input.characterSystemPrompt !== undefined) {
          chat.characterSystemPrompt = input.characterSystemPrompt ?? "";
        }
        if (input.backgroundId !== undefined) {
          chat.backgroundId = input.backgroundId;
        }
        queryClient.setQueryData<ChatConfigClient>(key, { ...previous, chat });
      }
      return { previous };
    },
    onError: (_error, input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(chatConfigKeys.detail(input.id), context.previous);
      }
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: chatConfigKeys.detail(variables.id) });
    },
  });
}
