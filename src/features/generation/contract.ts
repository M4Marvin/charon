import type { ModelMessage } from "@tanstack/ai";
import type { CharacterDataV2 } from "@/lib/st-core/character/types";
import type { ChatMessage } from "@/lib/st-core/shared/types";
import type { LoreEntry } from "@/lib/st-core/lorebook/types";
import type { ChatCompletionPreset } from "@/lib/chat/types";
import type {
  ChatConfig,
  PersonaInfo,
  UserSettingsView,
} from "@/features/chat/config/types";
import type { ResolvedProvider } from "@/features/chat/generation/types";

export type PromptMode = "chat" | "impersonate" | "image" | "rewrite" | "transform";

export type Trigger =
  | "send"
  | "regenerate"
  | "continue"
  | "impersonate"
  | "image"
  | "rewrite"
  | "transform";

export type JobStatus =
  | "queued"
  | "running"
  | "finalizing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired";

export type InsertionTarget =
  | { kind: "append" }
  | { kind: "sibling"; messageLocalId: number }
  | { kind: "replace"; messageLocalId: number; baseRev: number; baseHash: string }
  | { kind: "insertAfter"; messageLocalId: number; role: "user" | "assistant" }
  | { kind: "draft" };

export interface ToolContext {
  userId: string;
  chatId: string;
  jobId: string;
  mode: PromptMode;
  baseLeafId: number;
  selection: number[];
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
  tags: string[];
  characterBook?: CharacterDataV2["character_book"];
}

export interface GenerationSnapshot {
  chatId: string;
  character: EffectiveCharacter;
  persona: PersonaInfo;
  path: ChatMessage[];
  loreEntries: LoreEntry[];
  preset: Partial<ChatCompletionPreset>;
  provider: ResolvedProvider;
  settings: UserSettingsView;
  config: ChatConfig;
  /** Messages selected for a rewrite/transform; excludes the target if requested. */
  selection?: ChatMessage[];
}

export interface CompiledPrompt {
  systemPrompts: string[];
  messages: ModelMessage[];
  modelOptions: Record<string, unknown>;
  stop?: string[];
  meta: {
    mode: PromptMode;
    promptHash: string;
    inputTokens: number;
    droppedMessages: number;
    activatedLore: number;
    hasPrefill: boolean;
  };
}

export interface GenerationRequestInput {
  requestId: string;
  chatId: string;
  trigger: Trigger;
  mode: PromptMode;
  content?: string;
  baseLeafId: number;
  target?: InsertionTarget;
  selection?: number[];
  instruction?: string;
  expectedRevision?: number;
}

export interface GenerationJobView {
  id: string;
  requestId: string;
  chatId: string;
  trigger: Trigger;
  promptMode: PromptMode;
  status: JobStatus;
  baseLeafId: number | null;
  placeholderLocalId: number | null;
  requiresConfirmation: boolean;
  result: Record<string, unknown> | null;
  error: { code: string; message: string } | null;
  usage: Record<string, unknown> | null;
  finishReason: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ProposalView {
  id: string;
  jobId: string;
  chatId: string;
  kind: "rewrite" | "transform" | "impersonate" | "image";
  status: "pending" | "accepted" | "rejected" | "superseded";
  targetLocalId: number | null;
  baseRev: number | null;
  baseHash: string | null;
  proposedContent: string;
  proposedRole: "user" | "assistant" | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface PrepareResult {
  jobId: string;
  placeholderLocalId: number | null;
  userLocalId: number | null;
  streamPath: string;
}
