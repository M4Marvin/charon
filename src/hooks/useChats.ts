import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createChat,
  deleteChat,
  getChat,
  getChatMessages,
  listChats,
  listChatsByCharacter,
  updateChatSettings,
} from "@/server/fns/chats";
import {
  cancelStreamFn,
  finalizeStreamFn,
  imagePromptFn,
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
import { applyDeleteOptimistic, applySwipeOptimistic } from "@/features/chat/tree/optimistic";
import type { ChatMessageRow } from "@/db/schema";

export const chatKeys = {
  all: ["chats"] as const,
  list: () => [...chatKeys.all, "list"] as const,
  byCharacter: (characterId: string) => [...chatKeys.all, "character", characterId] as const,
  detail: (id: string) => [...chatKeys.all, "detail", id] as const,
  messages: (id: string) => [...chatKeys.all, "messages", id] as const,
};

export function useChats() {
  return useQuery({
    queryKey: chatKeys.list(),
    queryFn: () => listChats(),
  });
}

export function useChatsByCharacter(characterId: string) {
  return useQuery({
    queryKey: chatKeys.byCharacter(characterId),
    queryFn: () => listChatsByCharacter({ data: { id: characterId } }),
    enabled: characterId.length > 0,
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

/**
 * Shared plumbing for optimistic message-tree mutations: cancel in-flight
 * reads, snapshot, apply the transform, then re-sync from the server on
 * settle. Rollbacks are version-guarded so an older overlapping mutation
 * cannot clobber a newer one's optimistic write.
 */
function useOptimisticMessagesMutation<TVariables extends { chatId: string }>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  apply: (rows: ChatMessageRow[], variables: TVariables) => ChatMessageRow[] | null,
) {
  const queryClient = useQueryClient();
  const versions = useRef(new Map<string, number>());

  return useMutation({
    mutationFn,
    onMutate: async (variables: TVariables) => {
      const key = chatKeys.messages(variables.chatId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ChatMessageRow[]>(key);
      const version = (versions.current.get(variables.chatId) ?? 0) + 1;
      versions.current.set(variables.chatId, version);
      if (previous) {
        const next = apply(previous, variables);
        if (next) queryClient.setQueryData(key, next);
      }
      return { previous, version };
    },
    onError: (_error: unknown, variables: TVariables, context) => {
      // A newer mutation for this chat already owns the cache; restoring our
      // older snapshot would undo its optimistic write.
      if (!context || versions.current.get(variables.chatId) !== context.version) return;
      if (context.previous) {
        queryClient.setQueryData(chatKeys.messages(variables.chatId), context.previous);
      }
    },
    onSettled: (_data: unknown, _error: unknown, variables: TVariables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
    },
  });
}

export function useSwipeMessage() {
  return useOptimisticMessagesMutation(
    (input: {
      chatId: string;
      messageLocalId: number;
      direction: "next" | "prev";
      createIfMissing?: { role: "user" | "assistant"; content: string };
    }) => swipeFn({ data: input }),
    (rows, variables) => applySwipeOptimistic(rows, variables.messageLocalId, variables.direction),
  );
}

export function useDeleteMessage() {
  return useOptimisticMessagesMutation(
    (input: { chatId: string; messageLocalId: number }) => deleteBranchFn({ data: input }),
    (rows, variables) => applyDeleteOptimistic(rows, variables.messageLocalId),
  );
}

export function useEditMessage() {
  return useOptimisticMessagesMutation(
    (input: { chatId: string; messageLocalId: number; content: string }) =>
      editMessageFn({ data: input }),
    (rows, variables) =>
      rows.map((row) =>
        row.localId === variables.messageLocalId ? { ...row, content: variables.content } : row,
      ),
  );
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
      void queryClient.invalidateQueries({ queryKey: ["chatConfig", variables.chatId] });
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
      void queryClient.invalidateQueries({ queryKey: ["chatConfig", variables.chatId] });
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
      void queryClient.invalidateQueries({ queryKey: ["chatConfig", variables.chatId] });
    },
  });
}

export function useUpdateChatSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      title?: string | null;
      characterDescription?: string | null;
      characterPersonality?: string | null;
      characterScenario?: string | null;
      characterSystemPrompt?: string | null;
      backgroundId?: string | null;
    }): Promise<{ id: string }> => updateChatSettings({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: ["chatConfig", variables.id] });
    },
  });
}

export function useRenameChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; title: string }) => updateChatSettings({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.all });
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
      impersonateFn({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
    },
  });
}

export function useImagePrompt() {
  return useMutation({
    mutationFn: (input: { chatId: string }): Promise<{ text: string }> =>
      imagePromptFn({ data: input }),
  });
}
