import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { useAcceptProposal, useDenyProposal, useRunProposal } from "@/hooks/useGenerationProposals";

export function TransformSelectionDialog({
  chatId,
  messageIds,
  open,
  onOpenChange,
}: {
  chatId: string;
  messageIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<{ proposalId: string; text: string } | null>(null);
  const run = useRunProposal();
  const accept = useAcceptProposal();
  const deny = useDenyProposal();

  // Accept/deny close the dialog through the controlled 'open' prop, which
  // does not call Radix's onOpenChange. Reset here so a reopened dialog never
  // shows a resolved proposal.
  useEffect(() => {
    if (open) return;
    setInstruction("");
    setProposal(null);
    run.reset();
    accept.reset();
    deny.reset();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transform {messageIds.length} messages</DialogTitle>
          <DialogDescription>
            The selected messages are the source. The result is a new message and is not applied
            until you accept it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="What should the result be? e.g. turn this into a scene summary, continue the scene, merge these beats…"
            rows={4}
          />
          {proposal ? (
            <div className="max-h-72 overflow-auto rounded-lg border border-(--border-subtle) bg-raised p-3 text-sm leading-6 whitespace-pre-wrap">
              {proposal.text}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {proposal ? (
            <>
              <Button
                variant="ghost"
                onClick={() =>
                  deny.mutate(proposal.proposalId, { onSuccess: () => onOpenChange(false) })
                }
                disabled={deny.isPending || accept.isPending}
              >
                Deny
              </Button>
              <Button
                onClick={() =>
                  accept.mutate(proposal.proposalId, { onSuccess: () => onOpenChange(false) })
                }
                disabled={accept.isPending || deny.isPending}
              >
                {accept.isPending ? <Spinner /> : "Accept"}
              </Button>
            </>
          ) : (
            <Button
              onClick={() =>
                run.mutate(
                  {
                    chatId,
                    trigger: "transform",
                    selection: messageIds,
                    instruction: instruction.trim() || undefined,
                  },
                  {
                    onSuccess: (result) =>
                      setProposal({ proposalId: result.proposalId, text: result.text }),
                  },
                )
              }
              disabled={run.isPending || messageIds.length === 0}
            >
              {run.isPending ? <Spinner /> : "Generate"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
