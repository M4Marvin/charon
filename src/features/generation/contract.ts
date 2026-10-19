import type { ModelMessage } from "@tanstack/ai";
import type { ChatMessage } from "@/lib/st-core/shared/types";
import type { LoreEntry } from "@/lib/st-core/lorebook/types";
import type { ChatCompletionPreset } from "@/lib/chat/types";
import type { PersonaInfo, ResolvedProvider, UserSettingsView } from "@/features/chat/config/types";

export type PromptMode = "chat" | "impersonate" | "image" | "rewrite" | "transform";

export type Trigger =
  | "send"
  | "regenerate"
  | "continue"
  | "impersonate"
  | "image"
  | "rewrite"
  | "transform";

export type InsertionTarget =
  | { kind: "append" }
  | { kind: "sibling"; messageLocalId: number }
  | { kind: "replace"; messageLocalId: number; baseRev: number; baseHash: string }
  | { kind: "insertAfter"; messageLocalId: number; role: "user" | "assistant" };

export interface ToolContext {
  userId: string;
  chatId: string;
}

export interface EffectiveCharacter {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  systemPrompt: string;
  mesExample: string;
  postHistoryInstructions: string;
  depthPrompt: string;
  depthPromptDepth: number;
  depthPromptRole: "system" | "user" | "assistant";
  creatorNotes: string;
  tags: string[];
}

export interface GenerationSnapshot {
  character: EffectiveCharacter;
  persona: PersonaInfo;
  path: ChatMessage[];
  loreEntries: LoreEntry[];
  preset: Partial<ChatCompletionPreset>;
  provider: ResolvedProvider;
  settings: UserSettingsView;
  /** Messages selected for a rewrite/transform; excludes the target if requested. */
  selection?: ChatMessage[];
}

export interface CompiledPrompt {
  systemPrompts: string[];
  messages: ModelMessage[];
  modelOptions: Record<string, unknown>;
  stop?: string[];
}

export interface ProposalView {
  id: string;
  jobId: string;
  chatId: string;
  kind: "rewrite" | "transform" | "impersonate" | "image";
  status: "pending" | "accepted" | "rejected";
  targetLocalId: number | null;
  baseRev: number | null;
  baseHash: string | null;
  proposedContent: string;
  proposedRole: "user" | "assistant" | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  resolvedAt: string | null;
}
