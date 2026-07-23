import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat as useAiChat, fetchServerSentEvents } from "@tanstack/ai-react";
import { getSession } from "@/server/session";
import {
  loadGenerationContext,
  buildPromptFromContext,
} from "@/features/chat/generation/prompt-context";
import { listChats, getChat, getMessages } from "@/features/chat/tree/service";
import {
  prepareStreamFn,
  finalizeStreamFn,
  cancelStreamFn,
  impersonateFn,
} from "@/features/chat/generation/fns";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import type { ChatMessage } from "@/lib/st-core/shared/types";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";

// ── Server fns ──────────────────────────────────────────────────────────────

const listDemoChats = createServerFn({ method: "GET" }).handler(async () => {
  const { user } = await getSession();
  return listChats(user.id);
});

const loadDemoContext = createServerFn({ method: "POST", strict: { output: false } })
  .validator((input: unknown) => input as { chatId: string })
  .handler(async ({ data }) => {
    const { chatId } = data;
    const { user } = await getSession();
    const chat = getChat(user.id, chatId);
    const messages = getMessages(user.id, chatId);
    if (messages.length === 0) return { error: "No messages" };

    const assistantMsg = [...messages].reverse().find(
      (m) => m.role === "assistant" && m.localId !== 0,
    );
    if (!assistantMsg) return { error: "No assistant message" };

    const ctx = await loadGenerationContext(user.id, user.name, chatId, assistantMsg.localId);
    const promptResult = buildPromptFromContext(ctx.prompt);

    const tree = treeFromNodes(messages);
    const treeData: Array<{
      localId: number;
      parentLocalId: number | null;
      role: string;
      content: string;
      children: number[];
      selectedChildLocalId: number | null;
      extra: Record<string, unknown> | null;
    }> = [];
    for (const [, node] of tree) {
      treeData.push({
        localId: node.localId,
        parentLocalId: node.parentLocalId,
        role: node.role,
        content: node.content,
        children: node.children,
        selectedChildLocalId: node.selectedChildLocalId,
        extra: (node.extra as Record<string, unknown>) ?? null,
      });
    }

    return {
      chat: { id: chatId, title: chat.title, lockState: chat.lockState, lockMessageLocalId: chat.lockMessageLocalId },
      tree: treeData.sort((a, b) => a.localId - b.localId),
      context: {
        userName: ctx.prompt.userName,
        userPersona: ctx.prompt.userPersona ?? null,
        extraLoreEntries: ctx.prompt.extraLoreEntries?.length ?? 0,
        userSystemPrompt: ctx.prompt.userSystemPrompt ?? null,
        userPostHistoryInstructions: ctx.prompt.userPostHistoryInstructions ?? null,
        characterDescription: ctx.prompt.characterDescription,
        characterPersonality: ctx.prompt.characterPersonality,
        characterScenario: ctx.prompt.characterScenario,
        characterSystemPrompt: ctx.prompt.characterSystemPrompt,
        character: {
          name: ctx.prompt.character.name,
          description: ctx.prompt.character.description,
          personality: ctx.prompt.character.personality,
          scenario: ctx.prompt.character.scenario,
          first_mes: ctx.prompt.character.first_mes,
          system_prompt: ctx.prompt.character.system_prompt,
          post_history_instructions: ctx.prompt.character.post_history_instructions,
        },
        chatHistory: ctx.prompt.chatHistory.map((m: ChatMessage) => ({
          localId: m.localId,
          role: m.role,
          content: m.content.substring(0, 200),
          parentLocalId: m.parentLocalId,
          children: m.children,
          extra: m.extra as Record<string, unknown> | undefined,
        })),
        preset: ctx.prompt.preset,
        defaultPreset: ctx.prompt.defaultPreset,
      },
      provider: {
        baseUrl: ctx.resolved.provider.baseUrl,
        model: ctx.resolved.model,
        hasDefaultHeaders: !!ctx.resolved.provider.defaultHeaders,
        hasApiKey: ctx.resolved.provider.apiKey.length > 0,
      },
      promptMessages: promptResult.messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content.substring(0, 300),
      })),
      modelOptions: promptResult.modelOptions,
    };
  });

// ── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/demo/generation")({
  component: GenerationDemo,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const roleColors: Record<string, string> = {
  system: "text-violet-400",
  user: "text-blue-400",
  assistant: "text-emerald-400",
};

const roleBg: Record<string, string> = {
  system: "bg-violet-500/10",
  user: "bg-blue-500/10",
  assistant: "bg-emerald-500/10",
};

interface FlatNode {
  localId: number;
  parentLocalId: number | null;
  role: string;
  content: string;
  children: number[];
  selectedChildLocalId: number | null;
  extra: Record<string, unknown> | null;
}

function TreeNode({
  node,
  nodes,
  depth = 0,
}: {
  node: FlatNode;
  nodes: FlatNode[];
  depth?: number;
}) {
  const parent = node.parentLocalId != null
    ? nodes.find((n) => n.localId === node.parentLocalId)
    : undefined;
  const isSelected = depth > 0 && parent?.selectedChildLocalId === node.localId;

  return (
    <div style={{ marginLeft: `${depth * 16}px` }}>
      <div
        className={cn(
          "px-2 py-1 my-[2px] rounded border text-xs font-mono transition-colors",
          isSelected
            ? "bg-accent text-accent-foreground border-accent"
            : depth === 0
              ? "bg-muted/50 text-foreground border-border"
              : "bg-card text-card-foreground border-border",
        )}
      >
        <strong>#{node.localId}</strong>{" "}
        <span className={roleColors[node.role] ?? "text-muted-foreground"}>
          {node.role}
        </span>{" "}
        <span className="text-muted-foreground">content:</span>{" "}
        <span className="text-foreground">
          &ldquo;{node.content.substring(0, 80)}
          {node.content.length > 80 ? "\u2026" : ""}&rdquo;
        </span>
        <span className="text-muted-foreground ml-2">
          children: [{node.children.join(",")}] sel:{" "}
          {node.selectedChildLocalId ?? "\u2014"}
        </span>
        {node.extra && Object.keys(node.extra).length > 0 && (
          <span className="text-chart-1 ml-2">
            extra: {JSON.stringify(node.extra)}
          </span>
        )}
      </div>
      {node.children.length > 0 &&
        node.children.map((childId) => {
          const child = nodes.find((n) => n.localId === childId);
          if (!child) return null;
          return <TreeNode key={childId} node={child} nodes={nodes} depth={depth + 1} />;
        })}
    </div>
  );
}

function JsonBlock({ data, label }: { data: unknown; label?: string }) {
  return (
    <div className="mb-4">
      {label && <div className="font-semibold mb-1 text-sm text-foreground">{label}</div>}
      <pre className="bg-muted text-foreground p-3 rounded-lg text-xs leading-relaxed overflow-auto max-h-96 m-0">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border p-4 mb-4">
      <h3 className="m-0 mb-3 text-[15px] font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function extractAssistantText(messages: any[]): string {
  const last = [...messages].reverse().find((m) => m.role === "assistant");
  if (!last) return "";
  return last.parts
    .filter((p: any) => p.type === "text")
    .map((p: any) => p.content)
    .join("");
}

// ── Page Component ──────────────────────────────────────────────────────────

function GenerationDemo() {
  const queryClient = useQueryClient();
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [mode, setMode] = useState<"send" | "regenerate" | "continue">("send");
  const [sendContent, setSendContent] = useState("Hello {{char}}!");
  const [targetMessageId, setTargetMessageId] = useState(0);

  // ── Streaming state
  const placeholderRef = useRef<number | null>(null);
  const chatIdRef = useRef(selectedChatId);
  useEffect(() => { chatIdRef.current = selectedChatId; }, [selectedChatId]);
  const [streamStatus, setStreamStatus] = useState<
    "idle" | "streaming" | "finalizing" | "error" | "fallback"
  >("idle");
  const [streamingText, setStreamingText] = useState("");

  // ── Impersonation state
  const [impersonateResult, setImpersonateResult] = useState("");
  const [impersonating, setImpersonating] = useState(false);

  const { data: chats } = useQuery({
    queryKey: ["demo-chats"],
    queryFn: () => listDemoChats(),
  });

  const { data: demoData, refetch: refetchDemo, isFetching: demoLoading } = useQuery({
    queryKey: ["demo-context", selectedChatId],
    queryFn: () => loadDemoContext({ data: { chatId: selectedChatId } }),
    enabled: selectedChatId.length > 0,
  });

  const cleanup = useCallback(() => {
    placeholderRef.current = null;
    setStreamStatus("idle");
    setStreamingText("");
    void refetchDemo();
    void queryClient.invalidateQueries({ queryKey: ["demo-context", selectedChatId] });
  }, [refetchDemo, queryClient, selectedChatId]);

  // ── SSE connection ──────────────────────────────────────────────────────

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
      const text = extractAssistantText(aiChat.messages);
      setStreamStatus("finalizing");
      if (text && placeholderRef.current) {
        finalizeStreamFn({
          data: { chatId: selectedChatId, messageLocalId: placeholderRef.current, content: text },
        })
          .then(() => cleanup())
          .catch(() => {
            if (placeholderRef.current) {
              cancelStreamFn({
                data: { chatId: selectedChatId, messageLocalId: placeholderRef.current },
              });
            }
            cleanup();
          });
      } else if (placeholderRef.current) {
        cancelStreamFn({
          data: { chatId: selectedChatId, messageLocalId: placeholderRef.current },
        });
        cleanup();
      } else {
        cleanup();
      }
    },
    onError: (err) => {
      /* eslint-disable-next-line no-console */ console.error("[demo][stream] onError:", err?.message ?? err, err);
      setStreamStatus("error");
      if (placeholderRef.current) {
        cancelStreamFn({
          data: { chatId: selectedChatId, messageLocalId: placeholderRef.current },
        });
      }
      placeholderRef.current = null;
    },
  });

  // ── Update streaming text live ──────────────────────────────────────────

  useEffect(() => {
    if (streamStatus !== "streaming") return;
    const text = extractAssistantText(aiChat.messages);
    if (text) setStreamingText(text);
  }, [aiChat.messages, streamStatus]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setStreamStatus("streaming");
    setStreamingText("");
    try {
      const input: Record<string, unknown> = { chatId: selectedChatId, mode };
      if (mode === "send") input.content = sendContent;
      if (mode === "regenerate") input.messageLocalId = targetMessageId;
      const result = await prepareStreamFn({ data: input });

      if ((result as any).mode === "fallback") {
        setStreamStatus("fallback");
        setTimeout(() => cleanup(), 2500);
        return;
      }

      placeholderRef.current = (result as any).assistantMessageLocalId as number;
      void aiChat.setMessages([]);
      void aiChat.sendMessage(mode === "send" ? sendContent : ".");
    } catch (e) {
      console.error("[demo] generate error", e);
      setStreamStatus("error");
    }
  }, [selectedChatId, mode, sendContent, targetMessageId, aiChat, cleanup]);

  const handleStop = useCallback(() => {
    if (placeholderRef.current) {
      cancelStreamFn({
        data: { chatId: selectedChatId, messageLocalId: placeholderRef.current },
      });
    }
    cleanup();
  }, [selectedChatId, cleanup]);

  const handleImpersonate = useCallback(async () => {
    setImpersonating(true);
    setImpersonateResult("");
    try {
      const result = await impersonateFn({ data: { chatId: selectedChatId } });
      setImpersonateResult((result as any).text as string);
    } catch (e) {
      setImpersonateResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setImpersonating(false);
  }, [selectedChatId]);

  const demo = demoData as Record<string, unknown> | undefined;
  const demoTree = ((demo?.tree ?? []) as FlatNode[]) as FlatNode[];
  const hasDemoData = demo && !("error" in demo);
  const ctx = hasDemoData ? (demo!.context as Record<string, unknown>) : null;

  const inputBase =
    "w-full px-2.5 py-1.5 rounded-md border border-input bg-input text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const btnBase =
    "w-full px-4 py-2 rounded-md border-none font-medium text-sm transition-colors cursor-pointer disabled:cursor-not-allowed";

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h1 className="m-0 text-xl font-bold">Generation Module Demo</h1>
          <Link to="/" className="text-sm text-primary hover:text-primary/80 transition-colors">
            Home
          </Link>
        </div>

        <div className="flex gap-4 flex-wrap">
          {/* ── Left panel ─────────────────────── */}
          <div className="flex-[1_1_400px] min-w-[300px]">
            <Section title="Chat Selector">
              <select
                value={selectedChatId}
                onChange={(e) => { setSelectedChatId(e.target.value); cleanup(); }}
                className={inputBase}
              >
                <option value="">{'\u2014'} Select a chat {'\u2014'}</option>
                {(chats as Array<Record<string, unknown>> | undefined)?.map(
                  (chat: Record<string, unknown>) => (
                    <option key={chat.id as string} value={chat.id as string}>
                      {chat.title as string} ({(chat as any).characterName})
                    </option>
                  ),
                )}
              </select>
            </Section>

            {demoLoading && (
              <Section title="Loading">
                <div className="text-muted-foreground text-sm">Loading demo data...</div>
              </Section>
            )}

            {demo && "error" in demo && (
              <Section title="Error">
                <div className="text-destructive font-mono text-sm">{demo.error as string}</div>
              </Section>
            )}

            {hasDemoData && (
              <>
                <Section title="Chat Info">
                  <JsonBlock data={demo!.chat} />
                </Section>

                <Section title="Message Tree">
                  <div className="font-mono text-xs">
                    {demoTree.map((node: FlatNode) => (
                      <TreeNode
                        key={node.localId}
                        node={node}
                        nodes={demoTree}
                        depth={node.parentLocalId == null ? 0 : undefined}
                      />
                    ))}
                  </div>
                </Section>

                <Section title="Built Prompt (ModelMessage[])">
                  {((demo!.promptMessages ?? []) as Array<{ role: string; content: string }>).map(
                    (m: { role: string; content: string }, i: number) => (
                      <div
                        key={i}
                        className={cn(
                          "mb-2 px-2.5 py-1.5 rounded text-xs font-mono",
                          roleBg[m.role] ?? "bg-muted",
                          roleColors[m.role] ?? "text-muted-foreground",
                        )}
                      >
                        <strong>{m.role}</strong>: {m.content}
                      </div>
                    ),
                  )}
                  {Object.keys((demo!.modelOptions as Record<string, unknown>) ?? {}).length > 0 && (
                    <JsonBlock data={demo!.modelOptions} label="Model Options" />
                  )}
                </Section>

                <Section title="Provider">
                  <JsonBlock data={demo!.provider} />
                </Section>

                <Section title="Character Data">
                  <JsonBlock data={ctx!.character} />
                </Section>

                <Section title="Chat History (truncated)">
                  <JsonBlock data={ctx!.chatHistory} />
                </Section>

                <Section title="Context Fields">
                  <JsonBlock
                    data={{
                      userName: ctx!.userName,
                      userPersona: ctx!.userPersona,
                      extraLoreEntries: ctx!.extraLoreEntries,
                      userSystemPrompt: ctx!.userSystemPrompt,
                      userPostHistoryInstructions: ctx!.userPostHistoryInstructions,
                      characterDescription: ctx!.characterDescription,
                      characterPersonality: ctx!.characterPersonality,
                      characterScenario: ctx!.characterScenario,
                      characterSystemPrompt: ctx!.characterSystemPrompt,
                    }}
                  />
                </Section>
              </>
            )}
          </div>

          {/* ── Right panel: controls ─────────── */}
          <div className="flex-[1_1_400px] min-w-[300px]">
            {/* ── 1. Generation Controls ────── */}
            <Section title="Generation">
              <div className="mb-3">
                <label className="block text-xs font-medium text-foreground mb-1">Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as any)}
                  disabled={streamStatus === "streaming"}
                  className={inputBase}
                >
                  <option value="send">send</option>
                  <option value="regenerate">regenerate</option>
                  <option value="continue">continue</option>
                </select>
              </div>

              {mode === "send" && (
                <div className="mb-3">
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Content (supports {'{{char}}'} {'{{user}}'})
                  </label>
                  <textarea
                    value={sendContent}
                    onChange={(e) => setSendContent(e.target.value)}
                    rows={3}
                    className={inputBase}
                  />
                </div>
              )}

              {mode === "regenerate" && (
                <div className="mb-3">
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Target Message Local ID
                  </label>
                  <input
                    type="number"
                    value={targetMessageId}
                    onChange={(e) => setTargetMessageId(Number(e.target.value))}
                    className={inputBase}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Available: {demoTree.map((n: FlatNode) => n.localId).join(", ")}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={!selectedChatId || streamStatus === "streaming" || streamStatus === "finalizing"}
                  className={cn(
                    btnBase,
                    "flex-1",
                    streamStatus === "streaming" || streamStatus === "finalizing"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  {streamStatus === "streaming"
                    ? "Streaming\u2026"
                    : streamStatus === "finalizing"
                      ? "Finalizing\u2026"
                      : `Generate (${mode})`}
                </button>
                {(streamStatus === "streaming" || streamStatus === "finalizing") && (
                  <button
                    onClick={handleStop}
                    className={cn(btnBase, "flex-none w-24 bg-destructive text-destructive-foreground hover:bg-destructive/90")}
                  >
                    Stop
                  </button>
                )}
              </div>

              <div className="mt-3 text-xs font-mono">
                {streamStatus === "idle" && (
                  <span className="text-muted-foreground">idle</span>
                )}
                {streamStatus === "streaming" && (
                  <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">streaming</span>
                )}
                {streamStatus === "finalizing" && (
                  <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded">finalizing</span>
                )}
                {streamStatus === "error" && (
                  <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded">error</span>
                )}
                {streamStatus === "fallback" && (
                  <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">
                    no provider — used default reply
                  </span>
                )}
              </div>
            </Section>

            {/* ── 2. Live Stream Output ──────── */}
            <Section title="Live Stream Output">
              {(streamStatus === "streaming" || streamStatus === "finalizing") && (
                <div className="bg-muted/50 border border-border rounded-lg p-3 min-h-[100px] max-h-[300px] overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {streamingText || (
                    <span className="text-muted-foreground italic">
                      {streamStatus === "streaming" ? "Waiting for first token\u2026" : "Finalizing\u2026"}
                    </span>
                  )}
                </div>
              )}
              {streamStatus === "error" && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-destructive text-sm font-mono">
                  The stream encountered an error. Check the server logs for details.
                </div>
              )}
              {streamStatus === "fallback" && (
                <div className="bg-muted/50 border border-border rounded-lg p-3 text-muted-foreground text-sm italic">
                  No provider configured. A default reply was written directly — no streaming needed.
                </div>
              )}
              {streamStatus === "idle" && (
                <div className="bg-muted/50 border border-border rounded-lg p-3 text-muted-foreground text-sm italic">
                  Run a generation above to see live AI output here.
                </div>
              )}
            </Section>

            {/* ── 3. Impersonate ──────────────── */}
            <Section title="Impersonate">
              <button
                onClick={handleImpersonate}
                disabled={impersonating || !selectedChatId}
                className={cn(
                  btnBase,
                  impersonating
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {impersonating ? "Running\u2026" : "Impersonate"}
              </button>

              {impersonateResult && (
                <>
                  <pre className="bg-muted/50 border border-border rounded-lg p-3 mt-3 font-mono text-xs leading-relaxed overflow-auto max-h-[200px] whitespace-pre-wrap">
                    {impersonateResult}
                  </pre>
                  <button
                    onClick={() => { setSendContent(impersonateResult); setMode("send"); }}
                    className={cn(btnBase, "mt-2 bg-muted text-foreground hover:bg-muted/80")}
                  >
                    Copy to Send Input
                  </button>
                </>
              )}
            </Section>

            {/* ── Workflow Guide ──────────────── */}
            <Section title="Workflow Guide">
              <ol className="text-sm m-0 pl-5 leading-relaxed text-foreground">
                <li><strong>Select a chat</strong> from the dropdown (left panel)</li>
                <li>Review the <strong>message tree</strong> and <strong>built prompt</strong></li>
                <li>
                  <strong>Generate</strong>: pick mode, click the button &mdash; the full pipeline runs
                  automatically (prepare {'\u2192'} stream {'\u2192'} finalize). If no provider is
                  configured, a random default reply is used instead.
                </li>
                <li>
                  <strong>Regenerate</strong>: enter an assistant message&apos;s localId, creates a new
                  sibling placeholder and streams into it.
                </li>
                <li>
                  <strong>Continue</strong>: creates a new assistant message from the active leaf.
                </li>
                <li>
                  <strong>Impersonate</strong>: calls the impersonation endpoint and shows the returned
                  text. Use &ldquo;Copy to Send Input&rdquo; to send it as a user message.
                </li>
                <li>
                  Watch the <strong>live stream output</strong> &mdash; tokens appear in real-time as
                  the AI generates them.
                </li>
                <li>
                  The tree view refreshes automatically after each operation.
                </li>
              </ol>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
