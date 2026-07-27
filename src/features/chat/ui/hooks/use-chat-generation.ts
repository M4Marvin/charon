import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat as useAiChat, fetchServerSentEvents } from "@tanstack/ai-react";
import { toast } from "sonner";
import { usePrepareStream, useFinalizeStream, useCancelStream } from "@/hooks/useChats";
import { useChatUiStore } from "../chat-store";

type StreamStatus = "idle" | "streaming" | "finalizing";

interface StartOpts {
  content?: string;
  messageLocalId?: number;
}

export interface ChatGeneration {
  status: StreamStatus;
  streamingText: string;
  isStreaming: boolean;
  start: (mode: "send" | "regenerate" | "continue", opts?: StartOpts) => Promise<void>;
  stop: () => void;
}

function extractAssistantText(messages: unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as Record<string, unknown>;
    if (msg.role !== "assistant") continue;
    if (!Array.isArray(msg.parts)) return "";
    return (msg.parts as Array<{ type: string; content: string }>)
      .filter((p) => p.type === "text")
      .map((p) => p.content)
      .join("");
  }
  return "";
}

export function useChatGeneration(
  chatId: string,
  lockMessageLocalId: number | null,
): ChatGeneration {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [streamingText, setStreamingText] = useState("");

  const chatIdRef = useRef(chatId);
  const placeholderRef = useRef<number | null>(null);
  const recoveredForRef = useRef<string | null>(null);

  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  const prepareStream = usePrepareStream();
  const finalizeStream = useFinalizeStream();
  const cancelStream = useCancelStream();

  const cancelRef = useRef(cancelStream);

  useEffect(() => {
    cancelRef.current = cancelStream;
  });

  const connection = useMemo(
    () =>
      fetchServerSentEvents("/api/chat-generate", () => ({
        body: {
          chatId: chatIdRef.current,
          assistantMessageLocalId: placeholderRef.current ?? 0,
        },
      })),
    [],
  );

  const aiChat = useAiChat({
    connection,
    onFinish: () => {
      const text = extractAssistantText(aiChatRef.current.messages);
      const ph = placeholderRef.current;
      const cid = chatIdRef.current;

      if (!text || !ph) {
        if (ph) {
          cancelRef.current.mutateAsync({ chatId: cid, messageLocalId: ph }).catch(() => {});
        }
        placeholderRef.current = null;
        useChatUiStore.getState().clearPlaceholder();
        setStatus("idle");
        setStreamingText("");
        return;
      }

      setStatus("finalizing");
      finalizeStream
        .mutateAsync({ chatId: cid, messageLocalId: ph, content: text })
        .then(() => {
          placeholderRef.current = null;
          useChatUiStore.getState().clearPlaceholder();
          setStatus("idle");
          setStreamingText("");
          void aiChatRef.current.setMessages([]);
        })
        .catch(() => {
          cancelRef.current.mutateAsync({ chatId: cid, messageLocalId: ph }).catch(() => {});
          placeholderRef.current = null;
          useChatUiStore.getState().clearPlaceholder();
          setStatus("idle");
          setStreamingText("");
        });
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      console.error("[chat] stream error:", e?.message ?? err);
      const ph = placeholderRef.current;
      const cid = chatIdRef.current;
      if (ph) {
        cancelRef.current.mutateAsync({ chatId: cid, messageLocalId: ph }).catch(() => {});
      }
      placeholderRef.current = null;
      useChatUiStore.getState().clearPlaceholder();
      setStatus("idle");
      setStreamingText("");
    },
  });

  const aiChatRef = useRef(aiChat);

  useEffect(() => {
    aiChatRef.current = aiChat;
  });

  useEffect(() => {
    if (status !== "streaming") return;
    const text = extractAssistantText(aiChat.messages);
    if (text) setStreamingText((prev) => (prev === text ? prev : text));
  }, [aiChat.messages, status]);

  useEffect(() => {
    if (!lockMessageLocalId) return;
    if (recoveredForRef.current === chatId) return;
    const placeholder = useChatUiStore.getState().activePlaceholderId;
    if (placeholder) return;

    recoveredForRef.current = chatId;
    placeholderRef.current = lockMessageLocalId;
    useChatUiStore.getState().setPlaceholder(lockMessageLocalId);
    setStatus("streaming");
    setStreamingText("");
    void aiChatRef.current.setMessages([]);
    void aiChatRef.current.sendMessage(".");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockMessageLocalId, chatId]);

  useEffect(() => {
    return () => {
      if (placeholderRef.current) {
        const oldId = chatIdRef.current;
        cancelRef.current.mutate(
          { chatId: oldId, messageLocalId: placeholderRef.current },
          { onError: () => {} },
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(
    async (mode: "send" | "regenerate" | "continue", opts?: StartOpts) => {
      setStatus("streaming");
      setStreamingText("");
      try {
        const result = await prepareStream.mutateAsync({
          chatId: chatIdRef.current,
          mode,
          content: opts?.content,
          messageLocalId: opts?.messageLocalId,
        });

        if (result.mode === "fallback") {
          toast.info("No AI provider configured — using a fallback reply");
          placeholderRef.current = null;
          useChatUiStore.getState().clearPlaceholder();
          setStatus("idle");
          setStreamingText("");
          return;
        }

        placeholderRef.current = result.assistantMessageLocalId;
        useChatUiStore.getState().setPlaceholder(result.assistantMessageLocalId);
        await aiChatRef.current.setMessages([]);
        await aiChatRef.current.sendMessage(mode === "send" ? (opts?.content ?? "") : ".");
      } catch (e) {
        console.error("[chat] generate error", e);
        placeholderRef.current = null;
        useChatUiStore.getState().clearPlaceholder();
        setStatus("idle");
        setStreamingText("");
      }
    },
    [prepareStream],
  );

  const stop = useCallback(() => {
    const ph = placeholderRef.current;
    const cid = chatIdRef.current;
    if (ph) {
      cancelRef.current.mutateAsync({ chatId: cid, messageLocalId: ph }).catch(() => {});
    }
    placeholderRef.current = null;
    useChatUiStore.getState().clearPlaceholder();
    setStatus("idle");
    setStreamingText("");
    void aiChatRef.current.setMessages([]);
  }, []);

  return {
    status,
    streamingText,
    isStreaming: status !== "idle",
    start,
    stop,
  };
}
