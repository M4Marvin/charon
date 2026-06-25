import type { ChatMessage } from "@/lib/st-core/shared/types.js";
import type { CharacterBook, DepthPrompt } from "@/lib/st-core/character/types.js";

export interface PipelineCharacter {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  character_book?: CharacterBook;
  depth_prompt?: DepthPrompt;
}

export interface ChatCompletionPreset {
  name: string;
  unlockedContextSize: boolean;
  contextSize: number;
  maxResponseLength: number;
  swipesPerGeneration: number;
  streaming: boolean;
  temperature: number;
  frequencyPenalty: number;
  presencePenalty: number;
  topP: number;
  seed: number;
  utilityPrompts: string[];
  continuePostfix: string;
  continuePrefill: boolean;
  characterNamesBehavior: "default" | "noNames" | "alwaysNames";
  squashSystemMessages: boolean;
  enableFunctionCalling: boolean;
  interleavedThinking: boolean;
  sendInlineMedia: boolean;
  inlineImageQuality: "low" | "medium" | "high";
  requestModelReasoning: boolean;
  reasoningEffort: "auto" | "low" | "medium" | "high" | "minimum" | "maximum";
  verbosity: "low" | "medium" | "high";
  logitBias: Record<string, number>;
  systemPrompt?: string;
  maxTokens?: number;
}

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
  name?: string;
}

export interface LoreEntryView {
  uid: number;
  key: string[];
  keysecondary: string[];
  content: string;
  comment: string;
  constant: boolean;
  order: number;
  position: number;
}

export interface LoreScanView {
  activated: LoreEntryView[];
  inactive: LoreEntryView[];
}

export interface PipelineStep {
  index: number;
  name: string;
  description: string;
  messages?: ModelMessage[];
  options?: Record<string, unknown>;
  finalRequest?: Record<string, unknown>;
  tokenCount?: number;
  diff: string;
  loreScan?: LoreScanView;
}

export interface PipelineInput {
  userMessage: string;
  preset: ChatCompletionPreset;
  character: PipelineCharacter;
  chatHistory: ChatMessage[];
}
