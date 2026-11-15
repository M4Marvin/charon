import { useState } from "react";
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
import { runProposalFn } from "@/features/generation/proposal-fns";

interface SelectionPromptDialogProps {
  chatId: string;
  messageIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (text: string) => void;
}

/**
 * Runs a custom prompt against the selected messages. The result is handed to
 * the composer as an editable draft; nothing is written to the chat.
 */
export function SelectionPromptDialog({
  chatId,
  messageIds,
  open,
  onOpenChange,
  onGenerated,
}: SelectionPromptDialogProps) {
  const [running, setRunning] = useState(false);

  // Returns the failure message for the form to display, or null on success.
  const generate = async (instruction: string): Promise<string | null> => {
    setRunning(true);
    try {
      const result = await runProposalFn({
        data: { chatId, trigger: "transform", selection: messageIds, instruction },
      });
      onGenerated(result.text);
      onOpenChange(false);
      return null;
    } catch (cause) {
      return cause instanceof Error ? cause.message : "Prompt failed";
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // The request cannot be cancelled, so keep the dialog open until it settles.
        if (!running) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prompt {messageIds.length} messages</DialogTitle>
          <DialogDescription>
            The selected messages are the input. The result is inserted into the composer; nothing
            is written to the chat until you send it.
          </DialogDescription>
        </DialogHeader>

        {/* The form lives inside the dialog content, so closing through any
            path (button, overlay, success) unmounts it — a reopened dialog
            never keeps a stale prompt, error, or spinner. */}
        <PromptForm messageIds={messageIds} running={running} onGenerate={generate} />
      </DialogContent>
    </Dialog>
  );
}

function PromptForm({
  messageIds,
  running,
  onGenerate,
}: {
  messageIds: number[];
  running: boolean;
  onGenerate: (instruction: string) => Promise<string | null>;
}) {
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    const instruction = prompt.trim();
    if (!instruction || messageIds.length === 0 || running) return;
    setError(null);
    const failure = await onGenerate(instruction);
    if (failure) setError(failure);
  };

  return (
    <>
      <div className="space-y-3">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="What should the model do with these messages? e.g. summarize these beats, tighten the prose, merge them into one message…"
          rows={4}
          aria-label="Prompt"
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>

      <DialogFooter>
        <Button
          onClick={() => void generate()}
          disabled={running || !prompt.trim() || messageIds.length === 0}
        >
          {running ? <Spinner /> : "Generate"}
        </Button>
      </DialogFooter>
    </>
  );
}
