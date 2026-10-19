import { useCallback, useEffect, useRef, useState } from "react";
import { useChat as useAiChat, fetchServerSentEvents } from "@tanstack/ai-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { chatKeys } from "@/hooks/useChats";
import { useChatUiStore } from "../chat-store";
import { clearGenerationOverlay } from "../generation-overlay";
import { clientTools } from "@/features/generation/tools";
import { prepareGenerationFn, cancelGenerationFn } from "@/features/generation/fns";

type StreamStatus = "idle" | "streaming" | "finalizing";

interface StartOpts {
  content?: string;
  messageLocalId?: number;
}

export interface GenerationChat {
  status: StreamStatus;
  streamingText: string;
  isStreaming: boolean;
  ownerChatId: string | null;
  start: (mode: "send" | "regenerate" | "continue", opts?: StartOpts) => Promise<void>;
  stop: () => void;
}

export function useGenerationChat(chatId: string): GenerationChat {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [streamingText, setStreamingText] = useState("");
  const [ownerChatId, setOwnerChatId] = useState<string | null>(null);
  const chatIdRef = useRef(chatId);
  const runChatIdRef = useRef(chatId);
  const jobIdRef = useRef<string | null>(null);
  const placeholderRef = useRef<number | null>(null);
  const streamTextRef = useRef("");
  /** Bumped by stop(), unmount, or a chat change; a stale prepare cannot start. */
  const runTokenRef = useRef(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  const resetRunState = useCallback(() => {
    streamTextRef.current = "";
    setStatus("idle");
    setStreamingText("");
    setOwnerChatId(null);
  }, []);

  const cancelAndRefresh = useCallback(
    (jobId: string, runChatId: string) => {
      void cancelGenerationFn({ data: { jobId } })
        .catch(() => {})
        .finally(() => {
          void queryClient.invalidateQueries({ queryKey: chatKeys.messages(runChatId) });
        });
    },
    [queryClient],
  );

  const teardown = useCallback(
    (runChatId: string, options: { cancel: boolean }) => {
      const jobId = jobIdRef.current;
      const placeholderId = placeholderRef.current;
      jobIdRef.current = null;
      placeholderRef.current = null;
      clearGenerationOverlay(runChatId, placeholderId);
      resetRunState();
      if (options.cancel && jobId) cancelAndRefresh(jobId, runChatId);
    },
    [cancelAndRefresh, resetRunState],
  );

  const connection = useRef(
    fetchServerSentEvents("/api/generation/chat", () => ({
      body: { jobId: jobIdRef.current ?? "" },
    })),
  ).current;

  const aiChat = useAiChat({
    threadId: chatId,
    persistence: true,
    connection,
    tools: clientTools,
    onChunk: (chunk: unknown) => {
      const value = chunk as { type?: string; delta?: string; content?: string };
      if (value.type !== "TEXT_MESSAGE_CONTENT") return;
      const piece = value.delta ?? value.content ?? "";
      if (!piece) return;
      streamTextRef.current += piece;
      setStreamingText(streamTextRef.current);
    },
    onFinish: () => {
      const runChatId = runChatIdRef.current;
      teardown(runChatId, { cancel: false });
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(runChatId) });
      void queryClient.invalidateQueries({ queryKey: ["chatConfig", runChatId] });
    },
    onError: (error: unknown) => {
      if (!(error instanceof Error && error.name === "AbortError")) {
        toast.error(error instanceof Error ? error.message : "Generation failed");
      }
      teardown(runChatIdRef.current, { cancel: true });
    },
  });

  const aiChatRef = useRef(aiChat);
  useEffect(() => {
    aiChatRef.current = aiChat;
  });

  // A navigation or unmount abandons the run; cancel it so the job cannot wedge
  // the next chat. The token also makes an in-flight prepare() a no-op.
  useEffect(() => {
    return () => {
      runTokenRef.current += 1;
      const jobId = jobIdRef.current;
      const placeholderId = placeholderRef.current;
      jobIdRef.current = null;
      placeholderRef.current = null;
      clearGenerationOverlay(runChatIdRef.current, placeholderId);
      if (jobId) void cancelGenerationFn({ data: { jobId } }).catch(() => {});
      resetRunState();
    };
  }, [chatId, resetRunState]);

  const start = useCallback(
    async (mode: "send" | "regenerate" | "continue", opts?: StartOpts) => {
      const token = ++runTokenRef.current;
      const activeChatId = chatIdRef.current;
      runChatIdRef.current = activeChatId;
      setOwnerChatId(activeChatId);
      setStatus("streaming");
      streamTextRef.current = "";
      setStreamingText("");
      let prepareSucceeded = false;

      try {
        const prepared = await prepareGenerationFn({
          data: {
            chatId: activeChatId,
            trigger: mode,
            content: opts?.content,
            messageLocalId: opts?.messageLocalId,
          },
        });
        if (token !== runTokenRef.current) {
          void cancelGenerationFn({ data: { jobId: prepared.jobId } }).catch(() => {});
          return;
        }
        prepareSucceeded = true;
        jobIdRef.current = prepared.jobId;
        placeholderRef.current = prepared.placeholderLocalId;
        useChatUiStore.getState().setPlaceholder(prepared.placeholderLocalId);
        if (mode === "send" && opts?.content) {
          useChatUiStore.getState().setPendingSend({
            chatId: activeChatId,
            content: opts.content,
          });
        }
        // Make the persisted placeholder visible so streamingText has a row
        // to render into; the pending overlay hides once that row arrives.
        void queryClient.invalidateQueries({ queryKey: chatKeys.messages(activeChatId) });
        await aiChatRef.current.sendMessage(".");
      } catch (error) {
        if (token !== runTokenRef.current) return;
        const message = error instanceof Error ? error.message : "Generation failed";
        toast.error(message);
        if (!prepareSucceeded && mode === "send" && opts?.content) {
          useChatUiStore.getState().setInputDraft(activeChatId, opts.content);
        }
        teardown(activeChatId, { cancel: true });
      }
    },
    [queryClient, teardown],
  );

  const stop = useCallback(() => {
    runTokenRef.current += 1;
    aiChatRef.current.stop();
    teardown(runChatIdRef.current, { cancel: true });
  }, [teardown]);

  return {
    status,
    streamingText,
    isStreaming: status !== "idle",
    ownerChatId,
    start,
    stop,
  };
}
