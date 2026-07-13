import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelStream,
  createChat,
  deleteChat,
  deleteMessageBranch,
  editMessage,
  finalizeStream,
  getChat,
  getChatMessages,
  impersonateMessage,
  listChats,
  prepareStreamMessage,
  sendMessage,
  swipeMessage,
  updateChatSettings,
  type SendResult,
  type StreamResult,
  type SwipeResult,
} from "@/server/fns/chats";

export const chatKeys = {
  all: ["chats"] as const,
  list: () => [...chatKeys.all, "list"] as const,
  detail: (id: string) => [...chatKeys.all, "detail", id] as const,
  messages: (id: string) => [...chatKeys.all, "messages", id] as const,
};

export function useChats() {
  return useQuery({
    queryKey: chatKeys.list(),
    queryFn: () => listChats(),
  });
}

export function useChat(id: string) {
  return useQuery({
    queryKey: chatKeys.detail(id),
    queryFn: () => getChat({ data: { id } }),
    enabled: id.length > 0,
  });
}

export function useChatMessages(id: string) {
  return useQuery({
    queryKey: chatKeys.messages(id),
    queryFn: () => getChatMessages({ data: { id } }),
    enabled: id.length > 0,
  });
}

export function useCreateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { characterId: string }) => createChat({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { chatId: string; content: string }): Promise<SendResult> =>
      sendMessage({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
    },
  });
}

export function useSwipeMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      chatId: string;
      messageLocalId: number;
      direction: "next" | "prev";
    }): Promise<SwipeResult> => swipeMessage({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { chatId: string; messageLocalId: number }) =>
      deleteMessageBranch({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { chatId: string; messageLocalId: number; content: string }) =>
      editMessage({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
    },
  });
}

export function usePrepareStream() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      chatId: string;
      mode: "send" | "regenerate" | "continue";
      content?: string;
      messageLocalId?: number;
    }): Promise<StreamResult> => prepareStreamMessage({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
    },
  });
}

export function useFinalizeStream() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      chatId: string;
      messageLocalId: number;
      content: string;
    }): Promise<{ messageLocalId: number; content: string }> => finalizeStream({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
    },
  });
}

export function useCancelStream() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      chatId: string;
      messageLocalId: number;
    }): Promise<{ deletedIds: number[] }> => cancelStream({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
    },
  });
}

export function useUpdateChatSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      characterDescription?: string | null;
      characterPersonality?: string | null;
      characterScenario?: string | null;
      characterSystemPrompt?: string | null;
      backgroundPath?: string | null;
    }): Promise<{ id: string }> => updateChatSettings({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.detail(variables.id) });
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }): Promise<{ id: string }> => deleteChat({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

export function useImpersonateMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { chatId: string }): Promise<{ text: string }> =>
      impersonateMessage({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
    },
  });
}
