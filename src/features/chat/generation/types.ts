import type { CharacterDataV2 } from "@/lib/st-core/character/types";
import type { ChatMessage } from "@/lib/st-core/shared/types";
import type { LoreEntry } from "@/lib/st-core/lorebook/types";
import type { ChatCompletionPreset } from "@/lib/chat/types";

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  defaultHeaders?: Record<string, string>;
  defaultModel?: string | null;
}

export interface ResolvedProvider {
  provider: ProviderConfig;
  model: string;
  preset: Partial<ChatCompletionPreset>;
}

export interface PromptContext {
  character: CharacterDataV2;
  chatHistory: ChatMessage[];
  preset: Partial<ChatCompletionPreset>;
  defaultPreset: ChatCompletionPreset;
  userName: string;
  userPersona?: string;
  extraLoreEntries?: LoreEntry[];
  userSystemPrompt?: string;
  userPostHistoryInstructions?: string;
  characterDescription?: string;
  characterPersonality?: string;
  characterScenario?: string;
  characterSystemPrompt?: string;
}

export interface GenerationContext {
  prompt: PromptContext;
  resolved: ResolvedProvider;
}

export interface PrepareStreamInput {
  chatId: string;
  mode: "send" | "regenerate" | "continue";
  content?: string;
  messageLocalId?: number;
}

export type PrepareStreamResult =
  | { mode: "stream"; assistantMessageLocalId: number }
  | { mode: "fallback"; assistantMessageLocalId: number };
