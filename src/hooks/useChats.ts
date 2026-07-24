import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createChat,
  deleteChat,
  getChat,
  getChatMessages,
  listChats,
  updateChatSettings,
} from "@/server/fns/chats";
import {
  cancelStreamFn,
  finalizeStreamFn,
  impersonateFn,
  prepareStreamFn,
} from "@/features/chat/generation/fns";
import {
  appendUserAndReplyFn,
  deleteBranchFn,
  editMessageFn,
  swipeFn,
} from "@/features/chat/tree/fns";
import type { PrepareStreamResult } from "@/features/chat/generation/types";

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

export function useAppendUserAndReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { chatId: string; content: string }) =>
      appendUserAndReplyFn({ data: input }),
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
      createIfMissing?: { role: "user" | "assistant"; content: string };
    }) => swipeFn({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { chatId: string; messageLocalId: number }) =>
      deleteBranchFn({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { chatId: string; messageLocalId: number; content: string }) =>
      editMessageFn({ data: input }),
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
    }): Promise<PrepareStreamResult> => prepareStreamFn({ data: input }),
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
    }): Promise<{ messageLocalId: number; content: string }> => finalizeStreamFn({ data: input }),
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
    }): Promise<{ deletedIds: number[] }> => cancelStreamFn({ data: input }),
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
      backgroundId?: string | null;
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
      impersonateFn({ data: input }) as Promise<{ text: string }>,
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
    },
  });
}
