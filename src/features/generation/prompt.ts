import type { ModelMessage } from "@tanstack/ai";
import type { ChatMessage } from "@/lib/st-core/shared/types";
import type { LoreEntry, LoreGlobalData } from "@/lib/st-core/lorebook/types";
import { LorePosition } from "@/lib/st-core/lorebook/types.js";
import { scanLoreEntries } from "@/lib/chat/lorebook";
import { ApproxTokenCounter } from "@/lib/st-core/shared/tokens.js";
import type { ChatCompletionPreset } from "@/lib/chat/types";
import type { CompiledPrompt, GenerationSnapshot, PromptMode } from "./contract";
import { ContextOverflowError } from "./errors";
import { DEFAULT_IMAGE_STYLE } from "./image";

const DEFAULT_TEMPERATURE = 0.8;
const DEFAULT_TOP_P = 1;
const DEFAULT_MAX_RESPONSE_LENGTH = 1200;
const DEFAULT_CONTEXT_SIZE = 8192;
const TOKEN_SAFETY_MARGIN = 512;

const DEFAULT_IMPERSONATION_PROMPT =
  "Write {{user}}'s next message in the roleplay. Match the narrative voice and prose style of the conversation so far. Stay in character — only narrate {{user}}'s actions and dialogue, not those of {{char}} or other characters. No OOC commentary.";

const REWRITE_CONTRACT = [
  "You are a precise prose editor working on an existing roleplay chat.",
  "Rewrite the selected text. Preserve the speaker, point of view, tense, and every established fact; improve clarity, rhythm, and flow without inventing new events.",
  "Return only the rewritten text. Do not add commentary, labels, quotation marks, or a speaker prefix.",
].join("\n");

const TRANSFORM_CONTRACT = [
  "You are a precise prose editor working on an existing roleplay chat.",
  "Transform the selected text as requested. Preserve the speaker, point of view, tense, and every established fact while applying the transformation.",
  "Return only the transformed text. Do not add commentary, labels, quotation marks, or a speaker prefix.",
].join("\n");

interface MacroNames {
  char: string;
  user: string;
}

function expandMacros(text: string | null | undefined, names: MacroNames): string {
  if (!text) return "";
  return text.replace(/\{\{(char|user)\}\}/gi, (_match, key: string) =>
    key.toLowerCase() === "char" ? names.char : names.user,
  );
}

function addPrompt(prompts: string[], text: string | null | undefined): void {
  const value = text?.trim();
  if (value) prompts.push(value);
}

function isConversationalMessage(
  message: ChatMessage,
): message is ChatMessage & { role: "user" | "assistant" } {
  return (
    message.localId !== 0 &&
    (message.role === "user" || message.role === "assistant") &&
    message.content.trim().length > 0
  );
}

function toModelMessages(history: ChatMessage[]): ModelMessage[] {
  return history.filter(isConversationalMessage).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

/**
 * Parse a character card's mes_example into user/assistant messages.
 *
 * Speakers are compared case-insensitively against the character and user
 * names. Lines without a recognized speaker alternate roles and keep their
 * full text. The resolved messages never carry a ModelMessage.name.
 */
function parseExampleMessages(mesExample: string, names: MacroNames): ModelMessage[] {
  if (!mesExample.trim() || mesExample.trim() === "<START>") return [];

  const messages: ModelMessage[] = [];
  const charName = names.char.trim().toLowerCase();
  const userName = names.user.trim().toLowerCase();

  for (const block of expandMacros(mesExample, names).split(/<START>/gi)) {
    let nextRole: "user" | "assistant" = "user";

    for (const rawLine of block.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;

      let role: "user" | "assistant" = nextRole;
      let content = line;
      const colon = line.indexOf(":");

      if (colon >= 0) {
        const speaker = line.slice(0, colon).trim().toLowerCase();
        if (speaker === charName) {
          role = "assistant";
          content = line.slice(colon + 1).trim();
        } else if (speaker === userName) {
          role = "user";
          content = line.slice(colon + 1).trim();
        }
      }

      if (!content) continue;
      messages.push({ role, content });
      nextRole = role === "user" ? "assistant" : "user";
    }
  }

  return messages;
}

function appendLoreEntries(prompts: string[], loreEntries: LoreEntry[], names: MacroNames): void {
  for (const entry of loreEntries) {
    const content = expandMacros(entry.content, names).trim();
    if (content) prompts.push(content);
  }
}

function scanLore(snapshot: GenerationSnapshot): {
  activated: LoreEntry[];
} {
  const globalData: LoreGlobalData = {
    personaDescription: snapshot.persona.description ?? "",
    characterDescription: snapshot.character.description,
    characterPersonality: snapshot.character.personality,
    characterDepthPrompt: snapshot.character.depthPrompt,
    scenario: snapshot.character.scenario,
    creatorNotes: snapshot.character.creatorNotes,
    trigger: "",
  };
  const entries = snapshot.loreEntries.filter(
    (entry) => !entry.disable && entry.content.trim().length > 0,
  );
  return scanLoreEntries(entries, snapshot.path, globalData);
}

function buildRoleplaySystemPrompts(
  snapshot: GenerationSnapshot,
  names: MacroNames,
  mode: "chat" | "impersonate",
  beforeLore: LoreEntry[],
  afterLore: LoreEntry[],
): string[] {
  const { character, persona, settings, preset } = snapshot;
  const prompts: string[] = [];

  addPrompt(prompts, expandMacros(settings.systemPrompt, names));

  for (const utilityPrompt of preset.utilityPrompts ?? []) {
    addPrompt(prompts, expandMacros(utilityPrompt, names));
  }

  appendLoreEntries(prompts, beforeLore, names);

  addPrompt(prompts, expandMacros(character.systemPrompt, names));
  addPrompt(prompts, expandMacros(character.description, names));

  if (character.personality.trim()) {
    addPrompt(
      prompts,
      expandMacros(`${character.name}'s personality: ${character.personality}`, names),
    );
  }

  if (character.scenario.trim()) {
    addPrompt(prompts, expandMacros(`Scenario: ${character.scenario}`, names));
  }

  appendLoreEntries(prompts, afterLore, names);

  if (persona.description?.trim()) {
    addPrompt(prompts, expandMacros(`${persona.name}'s persona: ${persona.description}`, names));
  }

  const postHistory = settings.postHistoryInstructions?.trim()
    ? settings.postHistoryInstructions
    : character.postHistoryInstructions;
  addPrompt(prompts, expandMacros(postHistory, names));

  if (mode === "impersonate") {
    const instruction = settings.impersonationPrompt?.trim()
      ? settings.impersonationPrompt
      : DEFAULT_IMPERSONATION_PROMPT;
    addPrompt(prompts, expandMacros(instruction, names));
  }

  return prompts;
}

function buildImageSystemPrompts(snapshot: GenerationSnapshot, names: MacroNames): string[] {
  const { character } = snapshot;
  const context: string[] = [];

  if (character.description.trim()) {
    context.push(`${character.name}: ${character.description}`);
  } else {
    context.push(character.name);
  }
  if (character.personality.trim()) context.push(`Personality: ${character.personality}`);
  if (character.scenario.trim()) context.push(`Scenario: ${character.scenario}`);
  if (character.tags.length > 0) context.push(`Tags: ${character.tags.join(", ")}`);

  return [
    expandMacros(context.join("\n"), names).trim(),
    [
      "You write concise image prompts for the current scene.",
      "Return only the scene delta: a comma-separated list of pose, action, setting, lighting, and expression tags that change for the current scene.",
      "Do not repeat the character's identity tags. Never invent or change the character's appearance; identity is assembled deterministically after your output.",
      "No prose, labels, quality tokens, or style/artist tags.",
      "Scene delta:",
    ].join("\n"),
    `Style suffix (added automatically, never repeat it): ${DEFAULT_IMAGE_STYLE}`,
  ].filter((prompt) => prompt.length > 0);
}

function buildEditorSystemPrompts(
  snapshot: GenerationSnapshot,
  names: MacroNames,
  mode: "rewrite" | "transform",
  instruction?: string,
): string[] {
  const { character } = snapshot;
  const context: string[] = [];

  if (character.name.trim()) {
    context.push(
      character.description.trim() ? `${character.name}: ${character.description}` : character.name,
    );
  }
  if (character.personality.trim()) context.push(`Personality: ${character.personality}`);
  if (character.scenario.trim()) context.push(`Scenario: ${character.scenario}`);
  if (character.tags.length > 0) context.push(`Tags: ${character.tags.join(", ")}`);

  const prompts: string[] = [];
  addPrompt(prompts, expandMacros(context.join("\n"), names));
  prompts.push(mode === "rewrite" ? REWRITE_CONTRACT : TRANSFORM_CONTRACT);
  if (instruction?.trim()) prompts.push(`Instruction: ${instruction.trim()}`);
  return prompts;
}

function resolveMaxTokens(preset: Partial<ChatCompletionPreset>): number {
  return preset.maxTokens ?? preset.maxResponseLength ?? DEFAULT_MAX_RESPONSE_LENGTH;
}

function buildModelOptions(
  preset: Partial<ChatCompletionPreset>,
  maxTokens: number,
  mode: PromptMode,
): Record<string, unknown> {
  const baseTemperature = preset.temperature ?? DEFAULT_TEMPERATURE;
  const options: Record<string, unknown> = {
    temperature:
      mode === "image"
        ? 0.2
        : mode === "rewrite" || mode === "transform"
          ? Math.min(baseTemperature, 0.8)
          : baseTemperature,
    top_p: preset.topP ?? DEFAULT_TOP_P,
    // Chat-completions providers use max_tokens; max_output_tokens is the
    // Responses API spelling and is not valid here.
    max_tokens: maxTokens,
    frequency_penalty: preset.frequencyPenalty ?? 0,
    presence_penalty: preset.presencePenalty ?? 0,
  };

  if (typeof preset.seed === "number" && preset.seed >= 0) {
    options.seed = preset.seed;
  }

  return options;
}

function countMessages(counter: ApproxTokenCounter, messages: ModelMessage[]): number {
  let total = 0;
  for (const message of messages) {
    if (typeof message.content === "string") total += counter.count(message.content);
  }
  return total;
}

function buildStopStrings(mode: PromptMode, characterName: string): string[] | undefined {
  if (mode !== "impersonate") return undefined;
  const name = characterName.trim();
  if (!name) return undefined;
  return [`\n${name}:`, `\n${name} :`];
}

function selectHistoryMessages(snapshot: GenerationSnapshot, mode: PromptMode): ModelMessage[] {
  if (mode === "image") return [];

  if ((mode === "rewrite" || mode === "transform") && snapshot.selection?.length) {
    const selected = toModelMessages(snapshot.selection);
    if (selected.length > 0) return selected;
  }

  return toModelMessages(snapshot.path);
}

/**
 * Compile a generation snapshot into the provider-agnostic prompt shape.
 *
 * Roleplay system/head text lands in `systemPrompts`. `messages` contains the
 * conversational turns plus at-depth depth-prompt/lore inserts; persisted
 * message content is never macro-expanded.
 */
export function compilePrompt(
  snapshot: GenerationSnapshot,
  mode: PromptMode,
  options?: { instruction?: string },
): CompiledPrompt {
  const names: MacroNames = {
    char: snapshot.character.name,
    user: snapshot.persona.name,
  };

  let systemPrompts: string[];
  let atDepthLore: LoreEntry[] = [];

  switch (mode) {
    case "chat":
    case "impersonate": {
      const scan = scanLore(snapshot);
      atDepthLore = scan.activated.filter((entry) => entry.position === LorePosition.AtDepth);
      systemPrompts = buildRoleplaySystemPrompts(
        snapshot,
        names,
        mode,
        scan.activated.filter((entry) => entry.position === LorePosition.Before),
        scan.activated.filter((entry) => entry.position === LorePosition.After),
      );
      break;
    }
    case "image":
      systemPrompts = buildImageSystemPrompts(snapshot, names);
      break;
    case "rewrite":
    case "transform":
      systemPrompts = buildEditorSystemPrompts(snapshot, names, mode, options?.instruction);
      break;
  }

  const examples =
    mode === "chat" || mode === "impersonate"
      ? parseExampleMessages(snapshot.character.mesExample, names)
      : [];
  const history = selectHistoryMessages(snapshot, mode);
  if (examples.length === 0 && history.length === 0 && mode !== "impersonate") {
    history.push({
      role: "user",
      content:
        mode === "image"
          ? "Write the image prompt delta for the current scene now."
          : "Proceed with the task now.",
    });
  }
  if (mode === "chat" || mode === "impersonate") {
    // TanStack's ModelMessage has no system role. System-role depth entries
    // keep their content but cannot be placed mid-history; user/assistant
    // entries do keep their configured depth.
    if (snapshot.character.depthPrompt.trim()) {
      const content = expandMacros(snapshot.character.depthPrompt, names).trim();
      if (content) {
        if (snapshot.character.depthPromptRole === "system") {
          systemPrompts.push(content);
        } else {
          const index = Math.max(0, history.length - snapshot.character.depthPromptDepth);
          history.splice(index, 0, { role: snapshot.character.depthPromptRole, content });
        }
      }
    }
    for (const entry of atDepthLore) {
      const content = expandMacros(entry.content, names).trim();
      if (!content) continue;
      if (entry.role === 1 || entry.role === 2) {
        const index = Math.max(0, history.length - Math.max(0, entry.depth));
        history.splice(index, 0, { role: entry.role === 1 ? "user" : "assistant", content });
      } else {
        systemPrompts.push(content);
      }
    }
  }
  const prefill: ModelMessage | null =
    mode === "impersonate" ? { role: "assistant", content: `${snapshot.persona.name}: ` } : null;

  const maxTokens = resolveMaxTokens(snapshot.preset);
  const contextSize = snapshot.preset.contextSize ?? DEFAULT_CONTEXT_SIZE;
  const budget = contextSize - maxTokens - TOKEN_SAFETY_MARGIN;
  const counter = new ApproxTokenCounter();

  const systemTokens = systemPrompts.reduce((total, prompt) => total + counter.count(prompt), 0);
  const exampleTokens = countMessages(counter, examples);
  const prefillTokens = prefill ? countMessages(counter, [prefill]) : 0;
  const lastHistoryTokens =
    history.length > 0 ? countMessages(counter, [history[history.length - 1]]) : 0;
  const mandatoryTokens = systemTokens + exampleTokens + prefillTokens + lastHistoryTokens;

  if (mandatoryTokens > budget) {
    throw new ContextOverflowError({
      message: `Prompt needs at least ${mandatoryTokens} tokens but only ${budget} are available (context ${contextSize}, reserving ${maxTokens} for output and ${TOKEN_SAFETY_MARGIN} for safety).`,
      estimatedTokens: mandatoryTokens,
      contextWindow: contextSize,
    });
  }

  const keptHistory = [...history];
  let totalTokens =
    systemTokens + exampleTokens + prefillTokens + countMessages(counter, keptHistory);

  while (totalTokens > budget && keptHistory.length > 1) {
    const dropped = keptHistory.shift();
    if (!dropped) break;
    totalTokens -= countMessages(counter, [dropped]);
  }

  if (totalTokens > budget) {
    throw new ContextOverflowError({
      message: `Prompt needs ${totalTokens} tokens but only ${budget} are available (context ${contextSize}, reserving ${maxTokens} for output and ${TOKEN_SAFETY_MARGIN} for safety).`,
      estimatedTokens: totalTokens,
      contextWindow: contextSize,
    });
  }

  const messages: ModelMessage[] = [...examples, ...keptHistory];
  if (prefill) messages.push(prefill);

  const modelOptions = buildModelOptions(snapshot.preset, maxTokens, mode);

  return {
    systemPrompts,
    messages,
    modelOptions,
    stop: buildStopStrings(mode, snapshot.character.name),
  };
}
