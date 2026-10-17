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

/**
 * Clears the generation overlay only when it still belongs to this run:
 * a continuation that outlives the hook must not wipe a newer run's state.
 */
function clearGenerationOverlay(chatId: string, placeholderId: number | null) {
  const store = useChatUiStore.getState();
  if (store.pendingSend?.chatId === chatId) store.clearPendingSend();
  if (placeholderId !== null && store.activePlaceholderId === placeholderId) {
    store.clearPlaceholder();
  }
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
  /** Bumped by stop(); a start() whose id no longer matches was superseded. */
  const generationRef = useRef(0);
  /** Mirrors status for synchronous reads in stop(). */
  const statusRef = useRef<StreamStatus>("idle");

  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const prepareStream = usePrepareStream();
  const finalizeStream = useFinalizeStream();
  const cancelStream = useCancelStream();

  // Only the stable `mutateAsync` goes into start()'s deps: the mutation object
  // is recreated every render and would make `start` unstable, defeating the
  // memo on ChatMessage during streaming.
  const prepareStreamAsync = prepareStream.mutateAsync;

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
        clearGenerationOverlay(cid, ph);
        setStatus("idle");
        setStreamingText("");
        return;
      }

      setStatus("finalizing");
      finalizeStream
        .mutateAsync({ chatId: cid, messageLocalId: ph, content: text })
        .then(() => {
          placeholderRef.current = null;
          clearGenerationOverlay(cid, ph);
          setStatus("idle");
          setStreamingText("");
          void aiChatRef.current.setMessages([]);
        })
        .catch(() => {
          cancelRef.current.mutateAsync({ chatId: cid, messageLocalId: ph }).catch(() => {});
          placeholderRef.current = null;
          clearGenerationOverlay(cid, ph);
          setStatus("idle");
          setStreamingText("");
        });
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      console.error("[chat] stream error:", e?.message ?? err);
      toast.error("Generation failed");
      const ph = placeholderRef.current;
      const cid = chatIdRef.current;
      if (ph) {
        cancelRef.current.mutateAsync({ chatId: cid, messageLocalId: ph }).catch(() => {});
      }
      placeholderRef.current = null;
      clearGenerationOverlay(cid, ph);
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
      // Supersede any in-flight prepare so a late resolve takes the
      // "superseded" branch and cancels the rows it created.
      generationRef.current++;
      // The finalize request already owns teardown; cancelling now would
      // race the write and can delete the completed reply. Its settling
      // promise clears the overlay once it resolves.
      if (placeholderRef.current !== null && statusRef.current === "finalizing") return;
      const owned = placeholderRef.current;
      if (owned) {
        cancelRef.current.mutate(
          { chatId: chatIdRef.current, messageLocalId: owned },
          { onError: () => {} },
        );
        placeholderRef.current = null;
      }
      clearGenerationOverlay(chatIdRef.current, owned);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(
    async (mode: "send" | "regenerate" | "continue", opts?: StartOpts) => {
      const myGeneration = ++generationRef.current;
      // Bind this run to the chat it started for. chatIdRef may change while
      // prepare is in flight (route param reuse), and cancelling/restoring
      // against the wrong chat would corrupt unrelated data.
      const activeChatId = chatIdRef.current;
      setStatus("streaming");
      setStreamingText("");
      useChatUiStore.getState().setPendingSend({
        chatId: activeChatId,
        content: mode === "send" ? (opts?.content ?? null) : null,
      });
      try {
        const result = await prepareStreamAsync({
          chatId: activeChatId,
          mode,
          content: opts?.content,
          messageLocalId: opts?.messageLocalId,
        });

        if (generationRef.current !== myGeneration) {
          // stop() ran while prepare was in flight: undo the rows/lock we
          // just created instead of starting a stream nobody owns.
          // (Fallback wrote final rows with no lock — nothing to undo.)
          if (result.mode === "stream") {
            cancelRef.current
              .mutateAsync({
                chatId: activeChatId,
                messageLocalId: result.assistantMessageLocalId,
              })
              .catch(() => {});
          }
          return;
        }

        if (result.mode === "fallback") {
          toast.info("No AI provider configured — using a fallback reply");
          placeholderRef.current = null;
          clearGenerationOverlay(activeChatId, null);
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
        if (generationRef.current !== myGeneration) {
          // A newer generation (or stop) owns the UI now; don't touch it.
          return;
        }
        const ph = placeholderRef.current;
        if (ph) {
          // prepare resolved, so the user row + placeholder were persisted;
          // tear the placeholder back down instead of leaving a lock behind.
          cancelRef.current
            .mutateAsync({ chatId: activeChatId, messageLocalId: ph })
            .catch(() => {});
        }
        placeholderRef.current = null;
        clearGenerationOverlay(activeChatId, ph);
        if (ph === null && mode === "send" && opts?.content) {
          // prepareStream is transactional: a throw before the placeholder
          // resolves means nothing was persisted, so the draft is safe to
          // hand back. If it did resolve, the message is already stored.
          useChatUiStore.getState().setInputDraft(activeChatId, opts.content);
          toast.error("Failed to send — draft restored");
        } else {
          toast.error("Generation failed");
        }
        setStatus("idle");
        setStreamingText("");
      }
    },
    [prepareStreamAsync],
  );

  const stop = useCallback(() => {
    // The finalize request already owns teardown; cancelling now would race
    // the write and can delete the completed reply.
    if (statusRef.current === "finalizing") return;
    // Invalidate any in-flight start() so a late prepare resolves into the
    // superseded branch above instead of starting an orphaned stream.
    generationRef.current++;
    const ph = placeholderRef.current;
    const cid = chatIdRef.current;
    placeholderRef.current = null;
    // Abort the transport, not just the local buffer. `setMessages([])` maps
    // to setMessagesManually and leaves the client `isLoading`; without this,
    // an immediate re-send is silently dropped by sendMessage and the old
    // run's onFinish would finalize onto the new placeholder.
    aiChatRef.current.stop();
    if (ph) {
      cancelRef.current.mutateAsync({ chatId: cid, messageLocalId: ph }).catch(() => {});
    }
    clearGenerationOverlay(cid, ph);
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
