import { useState } from "react";
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

export interface RewriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  messageLocalId: number;
  disabled?: boolean;
  onApplied?: () => void;
}

/**
 * Rewrite flow as a controlled dialog. Kept separate from the trigger so the
 * message action menu can open it from a menu item on mobile.
 */
export function RewriteDialog({
  open,
  onOpenChange,
  chatId,
  messageLocalId,
  disabled,
  onApplied,
}: RewriteDialogProps) {
  // The phase stays in the shell: the close-guard needs it while the form is
  // unmounted with the dialog content.
  const [phase, setPhase] = useState<Phase>("idle");
  const busy = phase !== "idle";

  const close = () => {
    setPhase("idle");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rewrite with AI</DialogTitle>
          <DialogDescription>
            The rewrite is a proposal until you accept it. Nothing is written before then.
          </DialogDescription>
        </DialogHeader>

        {/* The form lives inside the dialog content: closing through any path
            unmounts it, so a reopened dialog never keeps a stale instruction,
            proposal, error, or spinner. */}
        <RewriteForm
          chatId={chatId}
          messageLocalId={messageLocalId}
          disabled={disabled}
          phase={phase}
          setPhase={setPhase}
          close={close}
          onApplied={onApplied}
        />
      </DialogContent>
    </Dialog>
  );
}

interface RewriteFormProps {
  chatId: string;
  messageLocalId: number;
  disabled?: boolean;
  phase: Phase;
  setPhase: (phase: Phase) => void;
  close: () => void;
  onApplied?: () => void;
}

function RewriteForm({
  chatId,
  messageLocalId,
  disabled,
  phase,
  setPhase,
  close,
  onApplied,
}: RewriteFormProps) {
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<{ proposalId: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== "idle";

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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rewrite failed");
    } finally {
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
      close();
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
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not deny rewrite");
      setPhase("idle");
    }
  };

  return (
    <>
      <div className="space-y-3">
        <Textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Optional instruction: make it shorter, more formal, fix tense…"
          rows={3}
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {proposal ? (
          <div className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-(--border-subtle) bg-raised p-3 text-sm leading-6">
            {proposal.text}
          </div>
        ) : null}
      </div>

      <DialogFooter>
        {proposal ? (
          <>
            <Button variant="ghost" onClick={() => void deny()} disabled={busy}>
              {phase === "denying" ? <Spinner className="size-4" /> : null}
              Discard
            </Button>
            <Button onClick={() => void accept()} disabled={busy || disabled}>
              {phase === "accepting" ? <Spinner className="size-4" /> : null}
              Use this rewrite
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void generate()} disabled={busy || disabled}>
              {phase === "running" ? <Spinner className="size-4" /> : null}
              Generate
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  );
}
