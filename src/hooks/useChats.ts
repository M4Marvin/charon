import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createChat,
  deleteChat,
  deleteMessageBranch,
  editMessage,
  getChat,
  getChatMessages,
  listChats,
  sendMessage,
  swipeMessage,
  type SendResult,
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

export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }): Promise<{ id: string }> =>
      deleteChat({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}
