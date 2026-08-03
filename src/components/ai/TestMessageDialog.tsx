import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTestProviderChat, type AiProviderListItem } from "@/hooks/useAiProviders";
import type { ChatTestResult } from "@/server/fns/models";

interface TestMessageDialogProps {
  provider: AiProviderListItem | null;
  onClose: () => void;
}

const DEFAULT_TEST_MESSAGE = "Reply with the single word: OK";

export function TestMessageDialog({ provider, onClose }: TestMessageDialogProps) {
  const open = provider !== null;
  const testChat = useTestProviderChat();

  const [model, setModel] = useState("");
  const [message, setMessage] = useState(DEFAULT_TEST_MESSAGE);
  const [result, setResult] = useState<ChatTestResult | null>(null);

  useEffect(() => {
    if (provider) {
      setModel(provider.defaultModel ?? "");
      setMessage(DEFAULT_TEST_MESSAGE);
      setResult(null);
    }
  }, [provider, open]);

  const handleSend = () => {
    if (!provider) return;
    setResult(null);
    testChat.mutate(
      {
        providerId: provider.id,
        model: model.trim() || undefined,
        message: message.trim() || undefined,
      },
      {
        onSuccess: setResult,
        onError: (e) =>
          setResult({
            ok: false,
            latencyMs: 0,
            error: e instanceof Error ? e.message : "Test failed",
          }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test message</DialogTitle>
          <DialogDescription>
            Send a short message to {provider?.name ?? "provider"} and check the reply
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="tm-model">Model</Label>
            <Input
              id="tm-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="provider default"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tm-message">Message</Label>
            <Textarea
              id="tm-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
            />
          </div>
          {result ? (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                result.ok ? "border-brand/30 bg-brand/5" : "border-destructive/30 bg-destructive/5"
              }`}
            >
              {result.ok ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium">Success · {result.latencyMs}ms</p>
                  <p className="text-muted-foreground break-words whitespace-pre-wrap">
                    {result.reply}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-medium">Failed · {result.latencyMs}ms</p>
                  <p className="text-danger break-words whitespace-pre-wrap">{result.error}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={testChat.isPending}>
            Close
          </Button>
          <Button onClick={handleSend} disabled={testChat.isPending}>
            {testChat.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
