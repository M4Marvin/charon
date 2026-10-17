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
  /** The chat the live run belongs to, or null when idle. */
  ownerChatId: string | null;
  start: (mode: "send" | "regenerate" | "continue", opts?: StartOpts) => Promise<void>;
  stop: () => void;
}

function extractMessageText(message: unknown): string {
  const msg = message as Record<string, unknown> | null | undefined;
  if (!msg || msg.role !== "assistant" || !Array.isArray(msg.parts)) return "";
  return (msg.parts as Array<{ type: string; content: string }>)
    .filter((p) => p.type === "text")
    .map((p) => p.content)
    .join("");
}

function extractAssistantText(messages: unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as Record<string, unknown>;
    if (msg.role !== "assistant") continue;
    return extractMessageText(msg);
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
  const [ownerChatId, setOwnerChatId] = useState<string | null>(null);

  const chatIdRef = useRef(chatId);
  /** The chat a live run belongs to — not the route param, which can change mid-run. */
  const runChatIdRef = useRef(chatId);
  const placeholderRef = useRef<number | null>(null);
  const recoveredForRef = useRef<string | null>(null);
  /** Bumped by stop(); a start() whose id no longer matches was superseded. */
  const generationRef = useRef(0);
  /** Mirrors status for synchronous reads in stop(). */
  const statusRef = useRef<StreamStatus>("idle");
  /** True once sendMessage() has been invoked and until the transport ends. */
  const transportActiveRef = useRef(false);

  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const setRunStatus = useCallback((next: StreamStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  /**
   * Single teardown for a run: cancels the DB placeholder when asked, clears
   * the overlay, and returns every piece of live-run state to idle.
   */
  const resetRun = useCallback(
    (cancelPlaceholder: boolean) => {
      const ph = placeholderRef.current;
      const cid = runChatIdRef.current;
      placeholderRef.current = null;
      transportActiveRef.current = false;
      if (cancelPlaceholder && ph !== null) {
        cancelRef.current.mutateAsync({ chatId: cid, messageLocalId: ph }).catch(() => {});
      }
      clearGenerationOverlay(cid, ph);
      setRunStatus("idle");
      setStreamingText("");
      setOwnerChatId(null);
    },
    [setRunStatus],
  );

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
          chatId: runChatIdRef.current,
          assistantMessageLocalId: placeholderRef.current ?? 0,
        },
      })),
    [],
  );

  const aiChat = useAiChat({
    connection,
    onFinish: (message) => {
      const ph = placeholderRef.current;
      // Clear the transport flag even when this callback has no owner: a
      // stale duplicate must not leave the watchdog armed.
      transportActiveRef.current = false;
      if (ph === null) return;
      // The callback argument is newer than the render-time `messages`
      // snapshot, which can lag the last chunk.
      const text = message
        ? extractMessageText(message)
        : extractAssistantText(aiChatRef.current.messages);
      const cid = runChatIdRef.current;

      if (!text) {
        resetRun(true);
        return;
      }

      setRunStatus("finalizing");
      finalizeStream
        .mutateAsync({ chatId: cid, messageLocalId: ph, content: text })
        .then(() => {
          // A newer run may own the hook by the time the write settles.
          if (placeholderRef.current !== ph) return;
          resetRun(false);
          void aiChatRef.current.setMessages([]);
        })
        .catch(() => {
          if (placeholderRef.current !== ph) return;
          resetRun(true);
        });
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      console.error("[chat] stream error:", e?.message ?? err);
      toast.error("Generation failed");
      resetRun(true);
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

  // The processor drops whitespace-only assistant messages without firing
  // onStreamEnd, so a run can end with only the transport going idle. Treat
  // that exactly like an empty onFinish instead of leaving the chat streaming.
  useEffect(() => {
    if (!transportActiveRef.current) return;
    if (aiChat.isLoading) return;
    if (statusRef.current !== "streaming") return;
    resetRun(true);
  }, [aiChat.isLoading, resetRun]);

  useEffect(() => {
    if (
      typeof lockMessageLocalId !== "number" ||
      !Number.isInteger(lockMessageLocalId) ||
      lockMessageLocalId <= 0
    ) {
      // No live lock: allow a later lock on this chat to recover again.
      recoveredForRef.current = null;
      return;
    }
    if (recoveredForRef.current === chatId) return;
    const placeholder = useChatUiStore.getState().activePlaceholderId;
    if (placeholder) return;

    recoveredForRef.current = chatId;
    placeholderRef.current = lockMessageLocalId;
    runChatIdRef.current = chatId;
    useChatUiStore.getState().setPlaceholder(lockMessageLocalId);
    setOwnerChatId(chatId);
    setRunStatus("streaming");
    setStreamingText("");
    void aiChatRef.current.setMessages([]);
    const sent = aiChatRef.current.sendMessage(".");
    transportActiveRef.current = true;
    void sent;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockMessageLocalId, chatId]);

  useEffect(() => {
    return () => {
      // Supersede any in-flight prepare so a late resolve takes the
      // "superseded" branch and cancels the rows it created.
      generationRef.current++;
      transportActiveRef.current = false;
      // The finalize request already owns teardown; cancelling now would
      // race the write and can delete the completed reply. Its settling
      // promise clears the overlay once it resolves.
      if (placeholderRef.current !== null && statusRef.current === "finalizing") return;
      const owned = placeholderRef.current;
      if (owned) {
        cancelRef.current.mutate(
          { chatId: runChatIdRef.current, messageLocalId: owned },
          { onError: () => {} },
        );
        placeholderRef.current = null;
      }
      clearGenerationOverlay(runChatIdRef.current, owned);
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
      runChatIdRef.current = activeChatId;
      setOwnerChatId(activeChatId);
      setRunStatus("streaming");
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
          resetRun(false);
          return;
        }

        placeholderRef.current = result.assistantMessageLocalId;
        useChatUiStore.getState().setPlaceholder(result.assistantMessageLocalId);
        await aiChatRef.current.setMessages([]);
        // Mark the transport active only after the call has queued its own
        // loading state, so the watchdog cannot see it idle in between.
        const sent = aiChatRef.current.sendMessage(mode === "send" ? (opts?.content ?? "") : ".");
        transportActiveRef.current = true;
        await sent;
      } catch (e) {
        console.error("[chat] generate error", e);
        if (generationRef.current !== myGeneration) {
          // A newer generation (or stop) owns the UI now; don't touch it.
          return;
        }
        const ph = placeholderRef.current;
        resetRun(ph !== null);
        if (ph === null && mode === "send" && opts?.content) {
          // prepareStream is transactional: a throw before the placeholder
          // resolves means nothing was persisted, so the draft is safe to
          // hand back. If it did resolve, the message is already stored.
          useChatUiStore.getState().setInputDraft(activeChatId, opts.content);
          toast.error("Failed to send — draft restored");
        } else {
          toast.error("Generation failed");
        }
      }
    },
    [prepareStreamAsync, resetRun, setRunStatus],
  );

  const stop = useCallback(() => {
    // The finalize request already owns teardown; cancelling now would race
    // the write and can delete the completed reply.
    if (statusRef.current === "finalizing") return;
    const idle =
      statusRef.current === "idle" &&
      placeholderRef.current === null &&
      !transportActiveRef.current;
    // Invalidate any in-flight start() so a late prepare resolves into the
    // superseded branch above instead of starting an orphaned stream.
    generationRef.current++;
    // Abort the transport, not just the local buffer. `setMessages([])` maps
    // to setMessagesManually and leaves the client `isLoading`; without this,
    // an immediate re-send is silently dropped by sendMessage and the old
    // run's onFinish would finalize onto the new placeholder.
    aiChatRef.current.stop();
    if (idle) return;
    resetRun(placeholderRef.current !== null);
    void aiChatRef.current.setMessages([]);
  }, [resetRun]);

  return {
    status,
    streamingText,
    isStreaming: status !== "idle",
    ownerChatId,
    start,
    stop,
  };
}
