import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  useAcceptProposal,
  useDenyProposal,
  useRunProposal,
} from "@/hooks/useGenerationProposals";

export function MessageRewriteButton({
  chatId,
  messageLocalId,
  disabled,
}: {
  chatId: string;
  messageLocalId: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<{ proposalId: string; text: string } | null>(null);
  const run = useRunProposal();
  const accept = useAcceptProposal();
  const deny = useDenyProposal();

  const reset = () => {
    setInstruction("");
    setProposal(null);
    run.reset();
    accept.reset();
    deny.reset();
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-9 text-2 hover:text-brand"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label="Rewrite message with AI"
      >
        <Sparkles className="size-3.5" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rewrite with AI</DialogTitle>
            <DialogDescription>
              The rewrite is a proposal until you accept it. Nothing is written before then.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Optional instruction: make it shorter, more formal, fix tense…"
              rows={3}
            />
            {proposal ? (
              <div className="rounded-lg border border-(--border-subtle) bg-raised p-3 text-sm leading-6 whitespace-pre-wrap">
                {proposal.text}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            {proposal ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    deny.mutate(proposal.proposalId, { onSuccess: () => setOpen(false) });
                  }}
                  disabled={deny.isPending || accept.isPending}
                >
                  Deny
                </Button>
                <Button
                  onClick={() => {
                    accept.mutate(proposal.proposalId, { onSuccess: () => setOpen(false) });
                  }}
                  disabled={accept.isPending || deny.isPending}
                >
                  {accept.isPending ? <Spinner /> : "Accept rewrite"}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  run.mutate(
                    {
                      chatId,
                      trigger: "rewrite",
                      messageLocalId,
                      instruction: instruction.trim() || undefined,
                    },
                    {
                      onSuccess: (result) =>
                        setProposal({ proposalId: result.proposalId, text: result.text }),
                    },
                  );
                }}
                disabled={run.isPending}
              >
                {run.isPending ? <Spinner /> : "Generate rewrite"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
