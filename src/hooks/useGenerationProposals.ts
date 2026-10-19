import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { runProposalFn } from "@/features/generation/proposal-fns";

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
