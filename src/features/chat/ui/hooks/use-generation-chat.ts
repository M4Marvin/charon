import { useCallback, useEffect, useRef, useState } from "react";
import { useChat as useAiChat, fetchServerSentEvents } from "@tanstack/ai-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { chatKeys } from "@/hooks/useChats";
import { useChatUiStore } from "../chat-store";
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
  const queryClient = useQueryClient();

  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

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
      const value = chunk as { delta?: string; content?: string };
      const piece = value.delta ?? value.content ?? "";
      if (!piece) return;
      streamTextRef.current += piece;
      setStreamingText(streamTextRef.current);
    },
    onFinish: () => {
      setStatus("idle");
      setStreamingText("");
      setOwnerChatId(null);
      useChatUiStore.getState().clearPlaceholder();
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(runChatIdRef.current) });
      void queryClient.invalidateQueries({ queryKey: ["chatConfig", runChatIdRef.current] });
      jobIdRef.current = null;
      placeholderRef.current = null;
    },
    onError: (error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "Generation failed";
      toast.error(message);
      const jobId = jobIdRef.current;
      if (jobId) void cancelGenerationFn({ data: { jobId } }).catch(() => {});
      setStatus("idle");
      setStreamingText("");
      setOwnerChatId(null);
      useChatUiStore.getState().clearPlaceholder();
      jobIdRef.current = null;
      placeholderRef.current = null;
    },
  });

  const aiChatRef = useRef(aiChat);
  useEffect(() => {
    aiChatRef.current = aiChat;
  });

  const start = useCallback(
    async (mode: "send" | "regenerate" | "continue", opts?: StartOpts) => {
      const activeChatId = chatIdRef.current;
      runChatIdRef.current = activeChatId;
      setOwnerChatId(activeChatId);
      setStatus("streaming");
      streamTextRef.current = "";
      setStreamingText("");
      try {
        const prepared = await prepareGenerationFn({
          data: {
            chatId: activeChatId,
            trigger: mode,
            content: opts?.content,
            messageLocalId: opts?.messageLocalId,
          },
        });
        jobIdRef.current = prepared.jobId;
        placeholderRef.current = prepared.placeholderLocalId;
        useChatUiStore.getState().setPlaceholder(prepared.placeholderLocalId);
        if (mode === "send" && opts?.content) {
          useChatUiStore.getState().setPendingSend({
            chatId: activeChatId,
            content: opts.content,
          });
        }
        await aiChatRef.current.sendMessage(".");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Generation failed";
        toast.error(message);
        setStatus("idle");
        setStreamingText("");
        setOwnerChatId(null);
        useChatUiStore.getState().clearPlaceholder();
        if (mode === "send" && opts?.content) {
          useChatUiStore.getState().setInputDraft(activeChatId, opts.content);
        }
        jobIdRef.current = null;
        placeholderRef.current = null;
      }
    },
    [],
  );

  const stop = useCallback(() => {
    const jobId = jobIdRef.current;
    aiChatRef.current.stop();
    if (jobId) void cancelGenerationFn({ data: { jobId } }).catch(() => {});
    streamTextRef.current = "";
    setStatus("idle");
    setStreamingText("");
    setOwnerChatId(null);
    useChatUiStore.getState().clearPlaceholder();
    jobIdRef.current = null;
    placeholderRef.current = null;
  }, []);

  return {
    status,
    streamingText,
    isStreaming: status !== "idle",
    ownerChatId,
    start,
    stop,
  };
}
