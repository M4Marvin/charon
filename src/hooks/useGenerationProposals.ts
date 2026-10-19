import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { chatKeys } from "./useChats";
import {
  runProposalFn,
  acceptProposalFn,
  denyProposalFn,
  listProposalsFn,
} from "@/features/generation/proposal-fns";
import type { ProposalView } from "@/features/generation/contract";

export function useRunProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      chatId: string;
      trigger: "impersonate" | "image" | "rewrite" | "transform";
      content?: string;
      messageLocalId?: number;
      selection?: number[];
      instruction?: string;
    }) => runProposalFn({ data: input }),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(input.chatId) });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Proposal failed");
    },
  });
}

export function useAcceptProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => acceptProposalFn({ data: { proposalId } }),
    onSuccess: (result) => {
      const chatId = result.proposal.chatId;
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      void queryClient.invalidateQueries({ queryKey: ["generation", "proposals", chatId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not apply proposal");
    },
  });
}

export function useDenyProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => denyProposalFn({ data: { proposalId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["generation", "proposals"] });
    },
  });
}

export function useProposals(chatId: string) {
  return useQuery<ProposalView[]>({
    queryKey: ["generation", "proposals", chatId],
    queryFn: () => listProposalsFn({ data: { chatId } }),
  });
}
