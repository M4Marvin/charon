import { ApproxTokenCounter } from "@/lib/st-core/shared/tokens.js";
import type { CharacterDataV2 } from "@/lib/st-core/character/types.js";
import type { LoreConfig, LoreEntry } from "@/lib/st-core/lorebook/types.js";
import type { ChatMessage } from "@/lib/st-core/shared/types.js";
import type { PipelineCharacter, ChatCompletionPreset, ModelMessage } from "./types.js";
import { buildMessages } from "./context-builder.js";
import {
  squashSystemMessages,
  applyCharacterNames,
  applyContinuePostfix,
  applyContinuePrefill,
  truncateToContext,
} from "./pre-process.js";
import { buildOptions } from "./pipeline.js";

function v2ToPipelineCharacter(v2: CharacterDataV2): PipelineCharacter {
  return {
    name: v2.name,
    description: v2.description,
    personality: v2.personality,
    scenario: v2.scenario,
    first_mes: v2.first_mes,
    mes_example: v2.mes_example,
    creator_notes: v2.creator_notes,
    system_prompt: v2.system_prompt,
    post_history_instructions: v2.post_history_instructions,
    alternate_greetings: v2.alternate_greetings,
    character_book: v2.character_book,
    depth_prompt: v2.extensions?.depth_prompt,
  };
}

function mergePresetIntoPreset(
  dbPreset?: Partial<ChatCompletionPreset>,
): (defaults: ChatCompletionPreset) => ChatCompletionPreset {
  return (defaults: ChatCompletionPreset): ChatCompletionPreset => {
    if (!dbPreset) return defaults;
    return { ...defaults, ...dbPreset };
  };
}

export interface BuildChatPromptInput {
  character: CharacterDataV2;
  loreConfig?: LoreConfig;
  chatHistory: ChatMessage[];
  preset: Partial<ChatCompletionPreset>;
  defaultPreset: ChatCompletionPreset;
  userName: string;
  userPersona?: string;
  // Caller-filtered lorebook entries to merge with the character's
  // embedded book. Already filtered for: enabled lorebooks, per-user
  // entry disables. `context-builder` also pre-filters data.disable.
  extraLoreEntries?: LoreEntry[];
  // Per-user prompt overrides from user_settings. The system prompt is
  // injected as the first system message; post-history instructions
  // replace the character's when set.
  userSystemPrompt?: string;
  userPostHistoryInstructions?: string;
}

export interface BuildChatPromptResult {
  messages: ModelMessage[];
  modelOptions: Record<string, unknown>;
}

export function buildChatPrompt(input: BuildChatPromptInput): BuildChatPromptResult {
  const {
    character: v2,
    chatHistory,
    preset: dbPreset,
    defaultPreset,
    userName,
    userPersona,
    extraLoreEntries,
    userSystemPrompt,
    userPostHistoryInstructions,
  } = input;
  const counter = new ApproxTokenCounter();

  const pipelineChar = v2ToPipelineCharacter(v2);
  const preset = mergePresetIntoPreset(dbPreset)(defaultPreset);

  const { messages: assembled } = buildMessages(
    pipelineChar,
    chatHistory,
    preset,
    userName,
    userPersona,
    extraLoreEntries,
    userSystemPrompt,
    userPostHistoryInstructions,
  );

  // Pre-process
  let msgs = assembled;
  if (preset.squashSystemMessages) msgs = squashSystemMessages(msgs);
  msgs = applyCharacterNames(msgs, preset.characterNamesBehavior, pipelineChar.name, userName);
  if (preset.continuePostfix) msgs = applyContinuePostfix(msgs, preset.continuePostfix);
  if (preset.continuePrefill) msgs = applyContinuePrefill(msgs, preset.continuePrefill);
  const trimmed = truncateToContext(msgs, preset.contextSize, (t) => counter.count(t));
  msgs = trimmed.messages;

  const options = buildOptions(preset);
  const modelOptions = (options.modelOptions as Record<string, unknown>) ?? {};

  return { messages: msgs, modelOptions };
}
