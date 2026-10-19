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
  runProposalFn,
  acceptProposalFn,
  denyProposalFn,
} from "@/features/generation/proposal-fns";

type Phase = "idle" | "running" | "accepting" | "denying";

export function MessageRewriteButton({
  chatId,
  messageLocalId,
  disabled,
  onApplied,
}: {
  chatId: string;
  messageLocalId: number;
  disabled?: boolean;
  onApplied?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<{ proposalId: string; text: string } | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setInstruction("");
    setProposal(null);
    setPhase("idle");
    setError(null);
  };

  const generate = async () => {
    setPhase("running");
    setError(null);
    try {
      const result = await runProposalFn({
        data: {
          chatId,
          trigger: "rewrite",
          messageLocalId,
          instruction: instruction.trim() || undefined,
        },
      });
      setProposal({ proposalId: result.proposalId, text: result.text });
      setPhase("idle");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rewrite failed");
      setPhase("idle");
    }
  };

  const accept = async () => {
    if (!proposal) return;
    setPhase("accepting");
    setError(null);
    try {
      await acceptProposalFn({ data: { proposalId: proposal.proposalId } });
      onApplied?.();
      setOpen(false);
      reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not apply rewrite");
      setPhase("idle");
    }
  };

  const deny = async () => {
    if (!proposal) return;
    setPhase("denying");
    try {
      await denyProposalFn({ data: { proposalId: proposal.proposalId } });
      setOpen(false);
      reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not deny rewrite");
      setPhase("idle");
    }
  };

  const busy = phase !== "idle";

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
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {proposal ? (
              <div className="max-h-72 overflow-auto rounded-lg border border-(--border-subtle) bg-raised p-3 text-sm leading-6 whitespace-pre-wrap">
                {proposal.text}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            {proposal ? (
              <>
                <Button variant="ghost" onClick={() => void deny()} disabled={busy}>
                  {phase === "denying" ? <Spinner /> : "Deny"}
                </Button>
                <Button onClick={() => void accept()} disabled={busy}>
                  {phase === "accepting" ? <Spinner /> : "Accept rewrite"}
                </Button>
              </>
            ) : (
              <Button onClick={() => void generate()} disabled={busy}>
                {phase === "running" ? <Spinner /> : "Generate rewrite"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
