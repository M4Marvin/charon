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
import { runProposalFn } from "@/features/generation/proposal-fns";

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
}: {
  chatId: string;
  messageIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (text: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Closing through any path (button, overlay, success) resets the form so a
  // reopened dialog never keeps a stale prompt, error, or spinner.
  useEffect(() => {
    if (open) return;
    setPrompt("");
    setRunning(false);
    setError(null);
  }, [open]);

  const generate = async () => {
    const instruction = prompt.trim();
    if (!instruction || messageIds.length === 0 || running) return;
    setRunning(true);
    setError(null);
    try {
      const result = await runProposalFn({
        data: { chatId, trigger: "transform", selection: messageIds, instruction },
      });
      onGenerated(result.text);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Prompt failed");
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
      </DialogContent>
    </Dialog>
  );
}
