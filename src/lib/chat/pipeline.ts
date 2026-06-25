import { ApproxTokenCounter } from "@/lib/st-core/shared/tokens.js";
import { buildMessages } from "./context-builder.js";
import {
  squashSystemMessages,
  applyCharacterNames,
  applyContinuePostfix,
  applyContinuePrefill,
  truncateToContext,
  toModelMessages,
} from "./pre-process.js";
import type { PipelineInput, PipelineStep, ModelMessage, ChatCompletionPreset } from "./types.js";

export function buildOptions(preset: ChatCompletionPreset): Record<string, unknown> {
  const modelOptions: Record<string, unknown> = {};
  if (preset.temperature !== undefined) modelOptions.temperature = preset.temperature;
  if (preset.topP !== undefined) modelOptions.top_p = preset.topP;
  if (preset.maxResponseLength !== undefined) modelOptions.max_output_tokens = preset.maxResponseLength;
  if (preset.verbosity) modelOptions.verbosity = preset.verbosity;
  if (preset.frequencyPenalty && preset.frequencyPenalty !== 0) modelOptions.frequency_penalty = preset.frequencyPenalty;
  if (preset.presencePenalty && preset.presencePenalty !== 0) modelOptions.presence_penalty = preset.presencePenalty;
  if (preset.seed !== undefined && preset.seed !== -1) modelOptions.seed = preset.seed;
  if (preset.logitBias && Object.keys(preset.logitBias).length > 0) modelOptions.logit_bias = preset.logitBias;
  if (preset.requestModelReasoning) {
    modelOptions.reasoning = {
      effort: preset.reasoningEffort === "auto" ? undefined : preset.reasoningEffort,
      summary: "auto",
    };
  }
  if (preset.systemPrompt) modelOptions.systemPrompt = preset.systemPrompt;
  return {
    model: "gpt-4o",
    modelOptions,
    systemPrompts: preset.utilityPrompts.map((content) => ({ content })),
    tools: preset.enableFunctionCalling ? ["<tools would go here>"] : [],
  };
}

export function runPipeline(input: PipelineInput): PipelineStep[] {
  const { preset, character, chatHistory, userMessage } = input;
  const counter = new ApproxTokenCounter();
  const steps: PipelineStep[] = [];

  // Step 1: Raw Input
  const rawHistory: ModelMessage[] = [
    ...toModelMessages(chatHistory, character.name, "You"),
    { role: "user", content: userMessage, name: "You" },
  ];
  steps.push({
    index: 1,
    name: "Raw Input",
    description: "User message + chat history + preset",
    messages: rawHistory,
    diff: `+1 user message ("${userMessage.slice(0, 40)}…")`,
  });

  // Steps 2 & 3: Lorebook Scan + Context Assembly
  const allHistory = [
    ...chatHistory,
    {
      id: chatHistory.length + 1,
      parent_id: chatHistory.length,
      children: [] as number[],
      selected_child_id: null,
      role: "user" as const,
      content: userMessage,
      is_user: true,
    },
  ];
  const { messages: assembled, loreScan } = buildMessages(character, allHistory, preset, "You");
  const tokens3 = assembled.reduce((n, m) => n + counter.count(m.content), 0);

  steps.push({
    index: 2,
    name: "Lorebook Scan",
    description: "LoreBuffer key matching + constant entries",
    loreScan,
    diff: `${loreScan.activated.length} activated, ${loreScan.inactive.length} inactive`,
  });

  steps.push({
    index: 3,
    name: "Context Assembly",
    description: "renderStoryString + lorebook + depthPrompt + PromptAssembler + jailbreak",
    messages: assembled,
    tokenCount: tokens3,
    diff: `${loreScan.activated.length} lore entries injected, ${assembled.length} messages, ~${tokens3} tokens`,
  });

  // Step 4: Squash
  let msgs = assembled;
  if (preset.squashSystemMessages) {
    msgs = squashSystemMessages(msgs);
    const before = assembled.length;
    const after = msgs.length;
    steps.push({
      index: 4,
      name: "Squash System Messages",
      description: "Merge consecutive system messages",
      messages: msgs,
      diff: `${before - after} system msgs merged (${before} → ${after})`,
    });
  } else {
    steps.push({
      index: 4,
      name: "Squash System Messages",
      description: "(skipped — toggle off)",
      messages: msgs,
      diff: "no change",
    });
  }

  // Step 5: Character Names
  msgs = applyCharacterNames(msgs, preset.characterNamesBehavior, character.name, "You");
  steps.push({
    index: 5,
    name: "Character Names Behavior",
    description: `mode: ${preset.characterNamesBehavior}`,
    messages: msgs,
    diff: `name fields adjusted per "${preset.characterNamesBehavior}"`,
  });

  // Step 6: Continue
  if (preset.continuePostfix) msgs = applyContinuePostfix(msgs, preset.continuePostfix);
  if (preset.continuePrefill) msgs = applyContinuePrefill(msgs, preset.continuePrefill);
  steps.push({
    index: 6,
    name: "Continue Postfix/Prefill",
    description: `postfix="${preset.continuePostfix === " " ? "␣" : preset.continuePostfix}", prefill=${preset.continuePrefill}`,
    messages: msgs,
    diff: preset.continuePrefill
      ? "last user msg → assistant role"
      : preset.continuePostfix
        ? "postfix appended to last msg"
        : "no change",
  });

  // Step 7: Truncate
  const trunc = truncateToContext(msgs, preset.contextSize, (t) => counter.count(t));
  msgs = trunc.messages;
  steps.push({
    index: 7,
    name: "Truncate to Context",
    description: `budget: ${preset.contextSize} tokens`,
    messages: msgs,
    tokenCount: trunc.tokens,
    diff:
      trunc.dropped > 0
        ? `dropped ${trunc.dropped} oldest msgs, ${trunc.tokens}/${preset.contextSize} tokens`
        : `no truncation needed (${trunc.tokens}/${preset.contextSize})`,
  });

  // Step 8: Preset → Options
  const options = buildOptions(preset);
  steps.push({
    index: 8,
    name: "Preset → Options",
    description: "Map preset fields → chat() options",
    options,
    diff: `modelOptions + systemPrompts (${preset.utilityPrompts.length}) + tools (${preset.enableFunctionCalling ? "on" : "off"})`,
  });

  // Step 9: FINAL REQUEST (not sent)
  const finalRequest = {
    adapter: 'openaiChatCompletions("gpt-4o", { apiKey: "<from env>", baseURL: "<from env>" })',
    messages: msgs,
    ...options,
    stream: preset.streaming,
  };
  steps.push({
    index: 9,
    name: "FINAL REQUEST ⛔",
    description: "This object WOULD be passed to chat() — NOT sent in demo",
    finalRequest,
    diff: "STOP — no API call",
  });

  return steps;
}
