import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { runPipeline } from "@/lib/chat/pipeline.js";
import { DEFAULT_PRESET } from "@/lib/chat/preset.js";
import { SAMPLE_CHARACTER, SAMPLE_CHAT_HISTORY } from "@/lib/chat/sample-data.js";
import { cn } from "#/lib/utils";
import { Button } from "#/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "#/components/ui/card";
import { Switch } from "#/components/ui/switch";
import { Slider } from "#/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { Badge } from "#/components/ui/badge";
import { Label } from "#/components/ui/label";
import { Separator } from "#/components/ui/separator";
import { ScrollArea } from "#/components/ui/scroll-area";
import type {
  PipelineStep,
  ModelMessage,
  ChatCompletionPreset,
  LoreScanView,
  LoreEntryView,
} from "@/lib/chat/types.js";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [userMessage, setUserMessage] = useState("");
  const [preset, setPreset] = useState<ChatCompletionPreset>(DEFAULT_PRESET);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [error, setError] = useState<string | null>(null);

  const hasRun = steps.length > 0;

  const handleRun = () => {
    try {
      const msg = userMessage.trim() || "Tell me about your day.";
      const result = runPipeline({
        userMessage: msg,
        preset,
        character: SAMPLE_CHARACTER,
        chatHistory: SAMPLE_CHAT_HISTORY,
      });
      setSteps(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const updatePreset = <K extends keyof ChatCompletionPreset>(
    key: K,
    value: ChatCompletionPreset[K],
  ) => {
    setPreset((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <main className="flex flex-col md:flex-row min-h-dvh bg-background text-foreground">
      {/* Left panel */}
      <aside className="w-full md:w-[380px] md:min-w-[380px] shrink-0 border-b md:border-b-0 md:border-r border-border bg-card">
        <div className="h-dvh flex flex-col">
          <div className="p-4 pb-0 shrink-0">
            <h2 className="text-lg font-semibold tracking-tight">Pipeline Demo</h2>
          </div>
          <ScrollArea className="flex-1 p-4 pt-3">
            <div className="space-y-4">
              {/* Character card */}
              <Card size="sm">
                <CardHeader>
                  <CardTitle>{SAMPLE_CHARACTER.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {SAMPLE_CHARACTER.description}
                  </p>
                  <Separator />
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      First Message
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {SAMPLE_CHARACTER.first_mes}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Creator Notes
                    </h4>
                    <p className="text-xs text-muted-foreground">{SAMPLE_CHARACTER.creator_notes}</p>
                  </div>
                  {SAMPLE_CHARACTER.depth_prompt && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Depth Prompt
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs mr-1.5">
                          d={SAMPLE_CHARACTER.depth_prompt.depth}
                        </Badge>
                        {SAMPLE_CHARACTER.depth_prompt.role}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {SAMPLE_CHARACTER.depth_prompt.prompt}
                      </p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Character Book ({SAMPLE_CHARACTER.character_book?.entries.length ?? 0} entries)
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {SAMPLE_CHARACTER.character_book?.name}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Chat history preview */}
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Chat History ({SAMPLE_CHAT_HISTORY.length})
                </h4>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {SAMPLE_CHAT_HISTORY.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "text-xs px-2 py-1 rounded-r border-l-2",
                        m.role === "user"
                          ? "border-primary bg-primary/10"
                          : "border-secondary bg-secondary/30",
                      )}
                    >
                      <span className="font-medium text-foreground">
                        {m.role === "user" ? "You" : SAMPLE_CHARACTER.name}:{" "}
                      </span>
                      <span className="text-muted-foreground">
                        {m.content.slice(0, 60)}
                        {m.content.length > 60 ? "…" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message input */}
              <div className="space-y-2">
                <Textarea
                  placeholder="Type a message for Cassie…"
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleRun();
                  }}
                  className="min-h-20"
                />
                <Button onClick={handleRun} className="w-full">
                  Run Pipeline →
                </Button>
              </div>

              <Separator />

              {/* Preset controls */}
              <div className="space-y-3 text-sm">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Preset Controls
                </h4>

                <div className="flex items-center justify-between">
                  <Label htmlFor="streaming">Streaming</Label>
                  <Switch
                    id="streaming"
                    checked={preset.streaming}
                    onCheckedChange={(v: boolean) => updatePreset("streaming", v)}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Temperature</Label>
                    <span className="text-xs font-mono text-muted-foreground">
                      {preset.temperature}
                    </span>
                  </div>
                  <Slider
                    value={[preset.temperature]}
                    onValueChange={(v: number[]) => updatePreset("temperature", v[0])}
                    min={0}
                    max={2}
                    step={0.1}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Context Size</Label>
                    <span className="text-xs font-mono text-muted-foreground">
                      {preset.contextSize.toLocaleString()}
                    </span>
                  </div>
                  <Slider
                    value={[preset.contextSize]}
                    onValueChange={(v: number[]) => updatePreset("contextSize", v[0])}
                    min={1024}
                    max={preset.unlockedContextSize ? 131072 : 32768}
                    step={512}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="squash">Squash System Messages</Label>
                  <Switch
                    id="squash"
                    checked={preset.squashSystemMessages}
                    onCheckedChange={(v: boolean) => updatePreset("squashSystemMessages", v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="prefill">Continue Prefill</Label>
                  <Switch
                    id="prefill"
                    checked={preset.continuePrefill}
                    onCheckedChange={(v: boolean) => updatePreset("continuePrefill", v)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="postfix" className="shrink-0">
                    Postfix
                  </Label>
                  <Input
                    id="postfix"
                    value={preset.continuePostfix}
                    onChange={(e) => updatePreset("continuePostfix", e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Character Names</Label>
                  <Select
                    value={preset.characterNamesBehavior}
                    onValueChange={(v: string) =>
                      updatePreset(
                        "characterNamesBehavior",
                        v as "default" | "noNames" | "alwaysNames",
                      )
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="noNames">No Names</SelectItem>
                      <SelectItem value="alwaysNames">Always Names</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Reasoning Effort</Label>
                  <Select
                    value={preset.reasoningEffort}
                    onValueChange={(v: string) =>
                      updatePreset("reasoningEffort", v as ChatCompletionPreset["reasoningEffort"])
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="minimum">Minimum</SelectItem>
                      <SelectItem value="maximum">Maximum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Verbosity</Label>
                  <Select
                    value={preset.verbosity}
                    onValueChange={(v: string) =>
                      updatePreset("verbosity", v as ChatCompletionPreset["verbosity"])
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </aside>

      {/* Right panel — Pipeline output */}
      <section className="flex-1">
        <ScrollArea className="h-dvh p-4 md:p-6">
          {error && (
            <Card size="sm" className="mb-4 border-destructive/50 bg-destructive/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
                  <span>⚠</span>
                  <span>Pipeline Error</span>
                </div>
                <pre className="text-xs text-destructive whitespace-pre-wrap font-mono">
                  {error}
                </pre>
              </CardContent>
            </Card>
          )}
          {hasRun ? (
            <div className="space-y-4 max-w-4xl">
              {steps.map((step) => (
                <StepCard key={step.index} step={step} />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </ScrollArea>
      </section>
    </main>
  );
}

/* ── Step Card ── */

function StepCard({ step }: { step: PipelineStep }) {
  const isFinal = step.index === 9;

  return (
    <Card size="sm" className={cn(isFinal && "border-destructive/50 bg-destructive/5")}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Badge variant={isFinal ? "destructive" : "outline"} className="shrink-0 mt-0.5">
            {step.index}
          </Badge>
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle>{step.name}</CardTitle>
              {step.tokenCount !== undefined && (
                <Badge variant="outline" className="text-xs font-mono">
                  ~{step.tokenCount} tok
                </Badge>
              )}
            </div>
            <CardDescription>{step.description}</CardDescription>
          </div>
          <span className="text-xs text-muted-foreground italic max-w-48 text-right shrink-0">
            {step.diff}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {step.loreScan && <LorebookContent loreScan={step.loreScan} />}

        {step.messages && (
          <div className="space-y-2">
            {step.messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
          </div>
        )}

        {step.options && (
          <div className="rounded-lg bg-muted/50 p-3 overflow-x-auto">
            <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground">
              {JSON.stringify(step.options, null, 2)}
            </pre>
          </div>
        )}

        {step.finalRequest && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
              <span>⛔</span>
              <span>NOT SENT — demo halts here</span>
            </div>
            <div className="rounded-lg bg-destructive/10 p-3 overflow-x-auto">
              <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground">
                {JSON.stringify(step.finalRequest, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Message Bubble ── */

function MessageBubble({ msg }: { msg: ModelMessage }) {
  const roleClass =
    msg.role === "system"
      ? "border-muted bg-muted/30"
      : msg.role === "user"
        ? "border-primary bg-primary/10"
        : "border-secondary bg-secondary/20";

  return (
    <div className={cn("border-l-2 px-3 py-2 rounded-r", roleClass)}>
      {msg.name && (
        <div className="text-xs font-medium text-muted-foreground mb-0.5">{msg.name}</div>
      )}
      <div className="text-foreground whitespace-pre-wrap break-words">{msg.content}</div>
    </div>
  );
}

/* ── Lorebook Content ── */

function LorebookContent({ loreScan }: { loreScan: LoreScanView }) {
  return (
    <div className="space-y-2">
      {loreScan.activated.map((entry) => (
        <LoreEntryCard key={entry.uid} entry={entry} activated />
      ))}
      {loreScan.inactive.map((entry) => (
        <LoreEntryCard key={entry.uid} entry={entry} activated={false} />
      ))}
    </div>
  );
}

function LoreEntryCard({ entry, activated }: { entry: LoreEntryView; activated: boolean }) {
  return (
    <div
      className={cn(
        "border-l-2 px-3 py-2 rounded-r",
        activated ? "border-primary bg-primary/10" : "border-muted bg-muted/30 opacity-60",
      )}
    >
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Badge variant={activated ? "default" : "outline"} className="text-xs">
          {activated ? "ACTIVATED" : "INACTIVE"}
        </Badge>
        <span
          className={cn(
            "text-xs font-medium",
            activated ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {entry.comment}
        </span>
        {entry.constant && (
          <Badge variant="secondary" className="text-xs">
            constant
          </Badge>
        )}
      </div>
      {entry.key.length > 0 && (
        <div className="text-xs text-muted-foreground mb-1">
          keys: {entry.key.join(", ")}
          {entry.keysecondary.length > 0 && ` | secondary: ${entry.keysecondary.join(", ")}`}
        </div>
      )}
      <div className={cn("text-sm", activated ? "text-foreground" : "text-muted-foreground")}>
        {entry.content}
      </div>
    </div>
  );
}

/* ── Empty State ── */

function EmptyState() {
  return (
    <div className="flex items-center justify-center min-h-[60dvh]">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-3">⚡</div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Pipeline Visualization Demo</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Type a message and hit{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono">
            Run
          </kbd>{" "}
          to see the 9-step pre-processing pipeline in action.
        </p>
        <p className="text-xs text-muted-foreground/60 mt-3">
          No API calls — all processing happens client-side.
        </p>
      </div>
    </div>
  );
}
