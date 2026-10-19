import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { chatKeys } from "./useChats";
import {
  runProposalFn,
  acceptProposalFn,
  denyProposalFn,
} from "@/features/generation/proposal-fns";

export function useRunProposal() {
  return useMutation({
    mutationFn: (input: {
      chatId: string;
      trigger: "impersonate" | "image" | "rewrite" | "transform";
      content?: string;
      messageLocalId?: number;
      selection?: number[];
      instruction?: string;
    }) => runProposalFn({ data: input }),
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
      void queryClient.invalidateQueries({
        queryKey: chatKeys.messages(result.proposal.chatId),
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not apply proposal");
    },
  });
}

export function useDenyProposal() {
  return useMutation({
    mutationFn: (proposalId: string) => denyProposalFn({ data: { proposalId } }),
  });
}
